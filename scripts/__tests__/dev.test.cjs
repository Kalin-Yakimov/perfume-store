const { test } = require("node:test")
const assert = require("node:assert/strict")
const { buildDevEnvironment } = require("../dev.cjs")

test("local services share one temporary key without changing the parent environment", () => {
  const original = { Path: "preserved", SMTP_PASS: "test-placeholder" }
  const env = buildDevEnvironment(original, () => "a".repeat(64))
  assert.equal(env.STOREFRONT_REVALIDATION_SECRET, "a".repeat(64))
  assert.equal(env.STOREFRONT_REVALIDATION_URL, "http://localhost:8000/api/revalidate")
  assert.equal(env.NODE_ENV, "development")
  assert.equal(env.Path, original.Path)
  assert.equal(original.STOREFRONT_REVALIDATION_SECRET, undefined)
})

test("normal local launches generate independent strong keys", () => {
  const first = buildDevEnvironment({}).STOREFRONT_REVALIDATION_SECRET
  const second = buildDevEnvironment({}).STOREFRONT_REVALIDATION_SECRET
  assert.match(first, /^[a-f0-9]{64}$/)
  assert.notEqual(first, second)
})

test("explicit local environment overrides are preserved", () => {
  const env = buildDevEnvironment({
    STOREFRONT_REVALIDATION_SECRET: "b".repeat(64),
    STOREFRONT_REVALIDATION_URL: "http://127.0.0.1:8000/api/revalidate",
  }, () => { throw new Error("must not generate an override") })
  assert.equal(env.STOREFRONT_REVALIDATION_SECRET, "b".repeat(64))
  assert.equal(env.STOREFRONT_REVALIDATION_URL, "http://127.0.0.1:8000/api/revalidate")
})

test("development launcher cannot generate implicit production credentials", () => {
  assert.throws(() => buildDevEnvironment({ NODE_ENV: "production" }))
  assert.throws(() => buildDevEnvironment({ STOREFRONT_REVALIDATION_SECRET: "short" }))
  assert.throws(() => buildDevEnvironment({ STOREFRONT_REVALIDATION_SECRET: "REPLACE".repeat(10) }))
})
