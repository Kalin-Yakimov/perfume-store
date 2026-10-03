const { spawnSync } = require("node:child_process")

/** Stop only a child created by the caller, including its descendants on Windows. */
function terminateChild(child, signal, { platform = process.platform, run = spawnSync } = {}) {
  if (child.exitCode !== null || child.signalCode !== null) return false
  if (platform !== "win32") return child.kill(signal)
  if (!Number.isSafeInteger(child.pid) || child.pid <= 0) return false

  try {
    const result = run("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
      timeout: 2000,
    })
    return !result.error && result.status === 0
  } catch {
    return false
  }
}

module.exports = { terminateChild }
