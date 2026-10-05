const { spawn } = require("node:child_process")
const { createServer } = require("node:net")
const path = require("node:path")
const { buildDevEnvironment } = require("./dev.cjs")
const { terminateChild } = require("./terminate-child.cjs")

/** A local production-mode frontend, never a production backend/deployment. */
function buildPreviewEnvironments(env, createSecret) {
  const backend = buildDevEnvironment(env, createSecret)
  backend.STOREFRONT_REVALIDATION_URL = "http://localhost:8000/api/revalidate"
  return {
    backend,
    storefront: {
      ...backend,
      NODE_ENV: "production",
      LOCAL_PREVIEW_RUN: "1",
      NEXT_PUBLIC_BASE_URL: "http://localhost:8000",
      NEXT_PUBLIC_MEDUSA_BACKEND_URL: "http://localhost:9000",
      MEDUSA_BACKEND_URL: "http://localhost:9000",
    },
  }
}

function assertPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once("error", () => reject(new Error(
      `Port ${port} is in use. Stop start-dev/other local services before starting preview.`,
    )))
    server.listen(port, "127.0.0.1", () => server.close(resolve))
  })
}

async function waitForBackend(child, signal) {
  const deadline = Date.now() + 180_000
  while (!signal.aborted && Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error("The local backend stopped before becoming ready.")
    try {
      const response = await fetch("http://localhost:9000/health", {
        signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]),
      })
      await response.body?.cancel()
      if (response.ok) return
    } catch {
      // Startup is expected to refuse connections until Medusa is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error("Local backend startup was cancelled or timed out.")
}

async function run() {
  // Refuse to replace existing user services. Cleanup only owns our children.
  await Promise.all([assertPortAvailable(8000), assertPortAvailable(9000)])
  const root = path.resolve(__dirname, "..")
  const envs = buildPreviewEnvironments(process.env)
  const children = new Set()
  const controller = new AbortController()
  const stop = () => {
    controller.abort()
    for (const child of children) terminateChild(child, "SIGTERM")
  }
  process.once("SIGINT", stop)
  process.once("SIGTERM", stop)
  const command = (args, cwd, env) => {
    const child = spawn(process.execPath, args, {
      cwd, env, stdio: "inherit", windowsHide: true,
    })
    children.add(child)
    const completed = new Promise((resolve, reject) => {
      child.once("error", () => reject(new Error("Could not start a local preview service.")))
      child.once("exit", (code) => {
        children.delete(child)
        code === 0 ? resolve() : reject(new Error("A preview service failed; see its output above."))
      })
    })
    // Observe early failures even before this promise is awaited.
    void completed.catch(() => undefined)
    return { child, completed }
  }
  try {
    const backend = command([require.resolve("turbo/bin/turbo"), "dev", "--filter=@dtc/backend"], root, envs.backend)
    await Promise.race([waitForBackend(backend.child, controller.signal), backend.completed.then(() => {
      throw new Error("The backend stopped before becoming ready.")
    })])
    if (controller.signal.aborted) return
    console.log("Building the local storefront once. Initial startup takes longer; browsing does not compile pages.")
    const next = require.resolve("next/dist/bin/next")
    const storefrontRoot = path.join(root, "apps/storefront")
    const build = command([next, "build"], storefrontRoot, envs.storefront)
    await Promise.race([build.completed, backend.completed.then(() => {
      throw new Error("The backend stopped during the preview build.")
    })])
    if (controller.signal.aborted) return
    const storefront = command([next, "start", "--port", "8000", "--hostname", "localhost"], storefrontRoot, envs.storefront)
    await Promise.race([storefront.completed, backend.completed])
  } catch (error) {
    if (!controller.signal.aborted) throw error
  } finally {
    stop()
    process.removeListener("SIGINT", stop)
    process.removeListener("SIGTERM", stop)
  }
}

module.exports = { buildPreviewEnvironments, assertPortAvailable }
if (require.main === module) run().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
