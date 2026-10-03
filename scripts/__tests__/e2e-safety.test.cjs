const test = require("node:test")
const assert = require("node:assert/strict")
const { testDatabaseEnvironment } = require("../run-e2e.cjs")

test("E2E runner rejects missing, remote and personal project database targets", () => {
  for (const value of [
    undefined,
    "postgres://user:pass@remote.example:5432/postgres",
    "postgres://user:pass@localhost:5433/postgres",
    "postgres://user:pass@localhost:55439/perfume",
    "postgres://user:pass@localhost/postgres",
    "https://localhost:55439/postgres",
    "postgres://user:pass@localhost:55439/postgres?sslmode=require",
    "postgres://user:pass@localhost:55439/postgres#other",
  ]) {
    assert.throws(() => testDatabaseEnvironment(value))
  }
})

test("E2E database environment is explicit and uses only the isolated cluster", () => {
  assert.deepEqual(
    testDatabaseEnvironment("postgres://test:pass@127.0.0.1:55439/postgres"),
    {
      DATABASE_URL: "postgres://test:pass@127.0.0.1:55439/postgres",
      DB_HOST: "localhost",
      DB_PORT: "55439",
      DB_USERNAME: "test",
      DB_PASSWORD: "pass",
    },
  )
})
