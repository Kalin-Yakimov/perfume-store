const { randomBytes } = require("node:crypto")
const { spawn } = require("node:child_process")
const path = require("node:path")
const { terminateChild } = require("./terminate-child.cjs")

/** Local-only shared, process-lifetime key. Never write it into .env or Git. */
function buildDevEnvironment(env, createSecret = () => randomBytes(32).toString("hex")) {
  if (env.NODE_ENV === "production") {
    throw new Error("Use the production start command with explicit cache synchronization configuration, not the development launcher.")
  }
  const secret = env.STOREFRONT_REVALIDATION_SECRET?.trim() || createSecret()
  if (secret.length < 32 || /^(change[-_ ]?me|replace)/i.test(secret)) {
    throw new Error("Storefront revalidation needs a random secret of at least 32 characters.")
  }
  return {
    ...env,
    NODE_ENV: "development",
    STOREFRONT_REVALIDATION_SECRET: secret,
    STOREFRONT_REVALIDATION_URL: env.STOREFRONT_REVALIDATION_URL?.trim() || "http://localhost:8000/api/revalidate",
  }
}

function run() {
  const child = spawn(process.execPath, [require.resolve("turbo/bin/turbo"), "dev"], {
    cwd: path.resolve(__dirname, ".."),
    env: buildDevEnvironment(process.env),
    stdio: "inherit",
    windowsHide: true,
  })
  const stop = (signal) => terminateChild(child, signal)
  process.on("SIGINT", () => stop("SIGINT"))
  process.on("SIGTERM", () => stop("SIGTERM"))
  child.on("error", () => {
    console.error("Could not start the development services.")
    process.exitCode = 1
  })
  child.on("exit", (code) => { process.exitCode = code ?? 1 })
}

module.exports = { buildDevEnvironment }
if (require.main === module) run()
