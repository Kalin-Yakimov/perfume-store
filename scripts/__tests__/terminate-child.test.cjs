const { test } = require("node:test")
const assert = require("node:assert/strict")
const { terminateChild } = require("../terminate-child.cjs")

const liveChild = (pid = 1234) => ({
  pid,
  exitCode: null,
  signalCode: null,
  kill: () => { throw new Error("Windows cleanup must include descendants") },
})

test("Windows cleanup targets only the owned PID and its descendants without a shell", () => {
  const calls = []
  const result = terminateChild(liveChild(), "SIGTERM", {
    platform: "win32",
    run: (...args) => { calls.push(args); return { status: 0 } },
  })
  assert.equal(result, true)
  assert.deepEqual(calls, [["taskkill.exe", ["/PID", "1234", "/T", "/F"], {
    stdio: "ignore",
    windowsHide: true,
    timeout: 2000,
  }]])
})

test("Windows cleanup refuses absent, invalid and unsafe process IDs", () => {
  let calls = 0
  for (const pid of [undefined, null, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1234", "1234 & other-command"]) {
    assert.equal(terminateChild({ ...liveChild(), pid }, "SIGKILL", {
      platform: "win32",
      run: () => { calls++; return { status: 0 } },
    }), false)
  }
  assert.equal(calls, 0)
})

test("already exited children are not signaled or used as cleanup targets", () => {
  let calls = 0
  for (const platform of ["win32", "linux"]) {
    for (const state of [{ exitCode: 0 }, { signalCode: "SIGTERM" }]) {
      assert.equal(terminateChild({ ...liveChild(), ...state }, "SIGKILL", {
        platform,
        run: () => { calls++; return { status: 0 } },
      }), false)
    }
  }
  assert.equal(calls, 0)
})

test("Windows cleanup failures and timeouts do not crash shutdown", () => {
  for (const result of [{ status: 1 }, { status: null, error: new Error("timed out") }]) {
    assert.equal(terminateChild(liveChild(), "SIGTERM", {
      platform: "win32",
      run: () => result,
    }), false)
  }
  assert.equal(terminateChild(liveChild(), "SIGTERM", {
    platform: "win32",
    run: () => { throw new Error("could not start taskkill") },
  }), false)
})

test("POSIX cleanup keeps forwarding the caller's original signals", () => {
  const signals = []
  const child = { ...liveChild(), kill: (signal) => { signals.push(signal); return true } }
  for (const signal of ["SIGINT", "SIGTERM", "SIGKILL"]) {
    assert.equal(terminateChild(child, signal, {
      platform: "linux",
      run: () => { throw new Error("must not run Windows cleanup") },
    }), true)
  }
  assert.deepEqual(signals, ["SIGINT", "SIGTERM", "SIGKILL"])
})

test("POSIX cleanup preserves a failed signal result", () => {
  let calls = 0
  assert.equal(terminateChild({ ...liveChild(), kill: () => false }, "SIGTERM", {
    platform: "darwin",
    run: () => { calls++; return { status: 0 } },
  }), false)
  assert.equal(calls, 0)
})
