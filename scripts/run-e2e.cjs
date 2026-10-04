const { spawn } = require("node:child_process")
const { createServer } = require("node:http")
const { randomBytes } = require("node:crypto")
const path = require("node:path")
const { cp, mkdir, mkdtemp, rm } = require("node:fs/promises")
const { terminateChild } = require("./terminate-child.cjs")

const root = path.resolve(__dirname, "..")
const children = new Set()
const listen = (server) =>
  new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () =>
      resolve((server.server || server).address().port),
    )
  })

function testDatabaseEnvironment(value) {
  if (!value)
    throw new Error(
      "Set E2E_DATABASE_URL to an isolated local PostgreSQL test cluster; never use the project database.",
    )
  const url = new URL(value)
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !url.port ||
    url.port === "5433" ||
    url.pathname !== "/postgres" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "E2E_DATABASE_URL must target /postgres on an explicit loopback test port other than the project's 5433.",
    )
  }
  return {
    DATABASE_URL: value,
    // Medusa's test utility recognises only the literal localhost as non-TLS.
    DB_HOST: "localhost",
    DB_PORT: url.port,
    DB_USERNAME: decodeURIComponent(url.username),
    DB_PASSWORD: decodeURIComponent(url.password),
  }
}

async function stopChildren() {
  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue
    const ended = new Promise((resolve) => {
      child.once("exit", resolve)
      setTimeout(resolve, 5000).unref()
    })
    terminateChild(child, "SIGTERM")
    await ended
    if (child.exitCode === null && child.signalCode === null)
      terminateChild(child, "SIGKILL")
  }
}

function command(args, cwd, env) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: "inherit",
    windowsHide: true,
  })
  children.add(child)
  child.once("exit", () => children.delete(child))
  return child
}

function exited(child, timeoutMs = 1_200_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      terminateChild(child, "SIGKILL")
      reject(new Error("E2E child exceeded its time limit"))
    }, timeoutMs)
    const finish = (error) => {
      clearTimeout(timer)
      error ? reject(error) : resolve()
    }
    child.once("error", () => finish(new Error("E2E child could not start")))
    child.once("exit", (code) =>
      finish(
        code === 0
          ? null
          : new Error("E2E child failed; see test output above"),
      ),
    )
  })
}

async function runBrowserSuite(backendUrl, publishableKey) {
  const baseURL = process.env.E2E_BASE_URL
  if (!baseURL || !process.env.E2E_MAIL_URL)
    throw new Error("Run E2E through the isolated root runner")
  console.log(`Checking isolated backend at ${backendUrl}`)
  const backendResponse = await fetch(`${backendUrl}/store/regions`, {
    headers: { "x-publishable-api-key": publishableKey },
    signal: AbortSignal.timeout(10_000),
  })
  if (!backendResponse.ok)
    throw new Error(
      `Isolated backend readiness failed: ${backendResponse.status}`,
    )
  await backendResponse.body?.cancel()
  const nextCli = require.resolve("next/dist/bin/next")
  const storefront = path.join(root, "apps/storefront")
  // Next writes type declarations/configuration while starting. Run a copy of
  // the actual sources, never copy personal env files or existing build output.
  const scratchRoot = path.join(storefront, ".e2e-app")
  await mkdir(scratchRoot, { recursive: true })
  const appDirectory = await mkdtemp(path.join(scratchRoot, "run-"))
  try {
    for (const entry of [
      "src",
      "public",
      "next.config.js",
      "check-env-variables.js",
      "postcss.config.js",
      "tailwind.config.js",
      "tsconfig.json",
      "package.json",
    ]) {
      await cp(path.join(storefront, entry), path.join(appDirectory, entry), {
        recursive: true,
      })
    }
    const env = {
      NEXT_PUBLIC_BASE_URL: baseURL,
      NEXT_PUBLIC_MEDUSA_BACKEND_URL: backendUrl,
      MEDUSA_BACKEND_URL: backendUrl,
      NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY: publishableKey,
      NEXT_PUBLIC_DEFAULT_REGION: "bg",
      NEXT_TELEMETRY_DISABLED: "1",
      STOREFRONT_REVALIDATION_SECRET: "",
      E2E_RUN: "1",
      NODE_ENV: "development",
      // The browser runner is not a nested Jest suite.
      JEST_WORKER_ID: undefined,
      NODE_OPTIONS: "",
    }
    const app = command(
      [
        nextCli,
        "dev",
        "--port",
        new URL(baseURL).port,
        "--hostname",
        "localhost",
      ],
      appDirectory,
      env,
    )
    let ready = false
    let readinessDetails = "no response"
    const readinessDeadline = Date.now() + 180_000
    for (let attempt = 0; Date.now() < readinessDeadline; attempt++) {
      if (app.exitCode !== null || app.signalCode !== null)
        throw new Error("Isolated storefront exited before becoming ready")
      try {
        const response = await fetch(`${baseURL}/vhod`, {
          signal: AbortSignal.timeout(30_000),
        })
        readinessDetails = `HTTP ${response.status}`
        await response.body?.cancel()
        if (response.ok) {
          ready = true
          break
        }
      } catch (error) {
        readinessDetails = error.message
      }
      if (attempt === 20)
        console.log(`Storefront readiness: ${readinessDetails}`)
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    if (!ready)
      throw new Error(
        `Isolated storefront did not become ready: ${readinessDetails}`,
      )
    const playwrightCli = require.resolve("@playwright/test/cli")
    await exited(
      command(
        [playwrightCli, "test", "--config", "playwright.config.ts"],
        storefront,
        {
          ...env,
          E2E_BACKEND_URL: backendUrl,
          E2E_PUBLISHABLE_KEY: publishableKey,
        },
      ),
    )
  } finally {
    await stopChildren()
    if (path.dirname(appDirectory) !== scratchRoot)
      throw new Error("Unsafe E2E cleanup path")
    // Windows can briefly keep Next's files locked after its process exits.
    // Retry only this verified scratch directory, never the real storefront.
    await rm(appDirectory, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 250,
    })
  }
}

async function main() {
  const dbEnv = testDatabaseEnvironment(process.env.E2E_DATABASE_URL)
  const { SMTPServer } = require("smtp-server")
  const messages = []
  const mailKey = randomBytes(24).toString("hex")
  const smtp = new SMTPServer({
    disabledCommands: ["STARTTLS"],
    logger: false,
    onAuth: (_auth, _session, callback) => callback(null, { user: "e2e" }),
    onRcptTo(address, _session, callback) {
      callback(
        address.address.endsWith("@example.invalid")
          ? null
          : new Error("Only synthetic E2E recipients are allowed"),
      )
    },
    onData(stream, session, callback) {
      let data = ""
      stream.on("data", (chunk) => {
        data += chunk.toString()
      })
      stream.on("end", () => {
        const decoded = data
          .replace(/=\r?\n/g, "")
          .replace(/=([0-9A-F]{2})/gi, (_match, byte) =>
            String.fromCharCode(parseInt(byte, 16)),
          )
        const links = [...decoded.matchAll(/https?:\/\/[^\s<>"']+/g)].map(
          (match) => match[0].replace(/&amp;/g, "&"),
        )
        messages.push({
          to: session.envelope.rcptTo.map((address) => address.address),
          links,
        })
        callback()
      })
      stream.on("error", callback)
    },
  })
  const inbox = createServer((request, response) => {
    if (
      request.method !== "GET" ||
      request.headers.authorization !== `Bearer ${mailKey}`
    ) {
      response.writeHead(403).end()
      return
    }
    const to = new URL(request.url, "http://localhost").searchParams.get("to")
    response.setHeader("Content-Type", "application/json")
    response.setHeader("Cache-Control", "no-store")
    response.end(
      JSON.stringify(messages.filter((message) => message.to.includes(to))),
    )
  })
  let cleanupStarted = false
  const cleanup = async () => {
    if (cleanupStarted) return
    cleanupStarted = true
    await stopChildren()
    inbox.closeAllConnections()
    await new Promise((resolve) => inbox.close(resolve))
    await new Promise((resolve) => smtp.close(resolve))
  }
  try {
    const smtpPort = await listen(smtp)
    const inboxPort = await listen(inbox)
    const reservation = createServer()
    const frontendPort = await listen(reservation)
    await new Promise((resolve) => reservation.close(resolve))
    // Next normalises loopback hosts to localhost in middleware rewrite URLs.
    const baseURL = `http://localhost:${frontendPort}`
    const env = {
      ...dbEnv,
      E2E_RUN: "1",
      E2E_BASE_URL: baseURL,
      E2E_MAIL_URL: `http://127.0.0.1:${inboxPort}`,
      E2E_MAIL_KEY: mailKey,
      NODE_ENV: "test",
      STORE_CORS: baseURL,
      AUTH_CORS: baseURL,
      ADMIN_CORS: baseURL,
      JWT_SECRET: randomBytes(32).toString("hex"),
      COOKIE_SECRET: randomBytes(32).toString("hex"),
      AUTH_MFA_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: String(smtpPort),
      SMTP_SECURE: "false",
      SMTP_USER: "e2e",
      SMTP_PASS: "test-only",
      SMTP_FROM_EMAIL: "store@example.invalid",
      STOREFRONT_URL: baseURL,
      STOREFRONT_REVALIDATION_SECRET: "",
      STOREFRONT_REVALIDATION_URL: "",
      REDIS_URL: "",
      MEDUSA_ADMIN_ONBOARDING_TYPE: "",
      MEDUSA_ADMIN_ONBOARDING_NEXTJS_DIRECTORY: "",
    }
    for (const signal of ["SIGINT", "SIGTERM"])
      process.once(signal, () => {
        process.exitCode = 1
        void cleanup()
      })
    await exited(
      command(
        [
          path.join(root, "apps/backend/scripts/run-jest.cjs"),
          "integration:e2e",
        ],
        path.join(root, "apps/backend"),
        env,
      ),
    )
  } finally {
    await cleanup()
  }
}

module.exports = { runBrowserSuite, testDatabaseEnvironment }
if (require.main === module)
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
