const { spawn } = require("node:child_process")
const { createServer } = require("node:http")
const { createHmac, randomBytes } = require("node:crypto")
const assert = require("node:assert/strict")
const path = require("node:path")
const { terminateChild } = require("./terminate-child.cjs")

const fixture = path.resolve(__dirname, "../apps/storefront/test-fixtures/cache-sync")
const nextCli = require.resolve("next/dist/bin/next")
const secret = randomBytes(32).toString("hex")
let publicVersion = 1
let sourceReads = 0
let app
let interrupted = false
const children = new Set()
const source = createServer((_request, response) => {
  sourceReads++
  response.setHeader("Content-Type", "application/json")
  response.end(JSON.stringify({ version: publicVersion }))
})

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const listen = (server) => new Promise((resolve, reject) => {
  server.once("error", reject)
  server.listen(0, "127.0.0.1", () => resolve(server.address().port))
})
const close = (server) => new Promise((resolve) => {
  server.closeAllConnections()
  server.close(resolve)
})

function command(args, env) {
  if (interrupted) throw new Error("Next.js cache test was interrupted")
  const child = spawn(process.execPath, [nextCli, ...args], {
    cwd: fixture,
    env: { ...process.env, ...env, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: "inherit",
    windowsHide: true,
  })
  children.add(child)
  child.once("exit", () => children.delete(child))
  return child
}

function exited(child) {
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timeout)
      child.off("error", failed)
      child.off("exit", ended)
      error ? reject(error) : resolve()
    }
    const failed = () => finish(new Error("Next.js fixture could not start"))
    const ended = (code) => finish(code === 0 ? undefined : new Error("Next.js fixture exited unsuccessfully"))
    const timeout = setTimeout(() => finish(new Error("Next.js fixture build exceeded ten minutes")), 600000)
    child.once("error", failed)
    child.once("exit", ended)
    if (child.exitCode !== null || child.signalCode !== null) ended(child.exitCode)
  })
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  const wait = (milliseconds) => new Promise((resolve) => {
    const ended = () => {
      clearTimeout(timeout)
      child.off("exit", ended)
      resolve()
    }
    const timeout = setTimeout(ended, milliseconds)
    child.once("exit", ended)
    if (child.exitCode !== null || child.signalCode !== null) ended()
  })
  const stopped = wait(5000)
  terminateChild(child, "SIGTERM")
  await stopped
  if (child.exitCode === null && child.signalCode === null) {
    const forced = wait(2000)
    terminateChild(child, "SIGKILL")
    await forced
  }
}

let cleanupPromise
function cleanup() {
  cleanupPromise ??= (async () => {
    await Promise.all([...children].map(stop))
    await close(source)
  })()
  return cleanupPromise
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => { interrupted = true; process.exitCode = 1; void cleanup() })
}

async function post(origin, resources, signatureIsValid = true, timestamp = String(Math.floor(Date.now() / 1000))) {
  const body = JSON.stringify({ version: 1, resources })
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")
  return fetch(`${origin}/api/revalidate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-storefront-revalidation-timestamp": timestamp,
      "x-storefront-revalidation-signature": signatureIsValid ? signature : "0".repeat(64),
    },
    body,
    signal: AbortSignal.timeout(5000),
  })
}

async function main() {
  const sourcePort = await listen(source)
  // Reserve an unused ephemeral port briefly; avoid fixed local project ports.
  const reservation = createServer()
  const appPort = await listen(reservation)
  await close(reservation)
  const origin = `http://127.0.0.1:${appPort}`
  const env = {
    NODE_ENV: "production",
    CACHE_TEST_SOURCE_URL: `http://127.0.0.1:${sourcePort}/public-data`,
    STOREFRONT_REVALIDATION_SECRET: secret,
  }

  await exited(command(["build", fixture], env))
  app = command(["start", fixture, "--port", String(appPort), "--hostname", "127.0.0.1"], env)
  let started = false
  for (let attempt = 0; attempt < 100; attempt++) {
    if (app.exitCode !== null || app.signalCode !== null) throw new Error("Next.js cache fixture could not start")
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1000) })
      void response.body?.cancel().catch(() => undefined)
      if (response.ok) { started = true; break }
    } catch {}
    await sleep(100)
  }
  assert.ok(started, "production-mode fixture becomes ready")

  const read = async () => {
    const response = await fetch(`${origin}/api/cached`, { signal: AbortSignal.timeout(5000) })
    assert.equal(response.status, 200)
    return response.json()
  }

  assert.deepEqual(await read(), { version: 1 })
  const warmReads = sourceReads
  publicVersion = 2
  assert.deepEqual(await read(), { version: 1 }, "public fetch actually remains cached")
  assert.equal(sourceReads, warmReads, "warm request does not reach the data source")

  assert.equal((await post(origin, ["products"], false)).status, 401)
  assert.deepEqual(await read(), { version: 1 }, "invalid signature cannot evict data")
  assert.equal((await post(origin, ["products"], true, String(Math.floor(Date.now() / 1000) - 301))).status, 401)
  assert.equal((await post(origin, ["customer"])).status, 400)
  assert.equal((await post(origin, ["categories"])).status, 200)
  assert.deepEqual(await read(), { version: 1 }, "unrelated tags leave products cached")
  const delivered = await post(origin, ["products", "variants"])
  assert.equal(delivered.status, 200)
  assert.equal(delivered.headers.get("cache-control"), "no-store")
  assert.deepEqual(await read(), { version: 2 }, "authenticated webhook evicts the real Next.js data cache")
  assert.equal(sourceReads, warmReads + 1)
  assert.equal((await post(origin, ["products", "variants"])).status, 200, "delivery is idempotent")
  console.log("PASS: production Next.js public cache, valid/invalid/expired signatures, allowed resources, tag isolation and repeat delivery.")
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
}).finally(cleanup)
