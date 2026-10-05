const { test } = require("node:test")
const assert = require("node:assert/strict")
const { createServer } = require("node:net")
const { buildPreviewEnvironments, assertPortAvailable } = require("../preview.cjs")

test("preview optimizes only the storefront and shares one temporary cache key", () => {
  const original = { Path: "preserved" }
  const { backend, storefront } = buildPreviewEnvironments(original, () => "a".repeat(64))
  assert.equal(backend.NODE_ENV, "development")
  assert.equal(storefront.NODE_ENV, "production")
  assert.equal(storefront.LOCAL_PREVIEW_RUN, "1")
  assert.equal(storefront.STOREFRONT_REVALIDATION_SECRET, backend.STOREFRONT_REVALIDATION_SECRET)
  assert.equal(backend.STOREFRONT_REVALIDATION_URL, `${storefront.NEXT_PUBLIC_BASE_URL}/api/revalidate`)
  assert.equal(original.NODE_ENV, undefined)
  assert.equal(original.LOCAL_PREVIEW_RUN, undefined)
})

test("preview always targets the local site rather than a deployment", () => {
  const env = {
    NEXT_PUBLIC_BASE_URL: "https://example.com",
    MEDUSA_BACKEND_URL: "https://api.example.com",
    NEXT_PUBLIC_MEDUSA_BACKEND_URL: "https://api.example.com",
    STOREFRONT_REVALIDATION_URL: "https://example.com/api/revalidate",
  }
  const { backend, storefront } = buildPreviewEnvironments(env)
  assert.equal(storefront.NEXT_PUBLIC_BASE_URL, "http://localhost:8000")
  assert.equal(storefront.MEDUSA_BACKEND_URL, "http://localhost:9000")
  assert.equal(storefront.NEXT_PUBLIC_MEDUSA_BACKEND_URL, "http://localhost:9000")
  assert.equal(backend.STOREFRONT_REVALIDATION_URL, "http://localhost:8000/api/revalidate")
  assert.equal(env.NEXT_PUBLIC_BASE_URL, "https://example.com")
  assert.throws(() => buildPreviewEnvironments({ NODE_ENV: "production" }))
})

test("preview refuses an occupied port without stopping the existing server", async () => {
  const server = createServer()
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = server.address().port
  try {
    await assert.rejects(assertPortAvailable(port), /in use/)
    assert.equal(server.listening, true)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
  await assertPortAvailable(port)
})
