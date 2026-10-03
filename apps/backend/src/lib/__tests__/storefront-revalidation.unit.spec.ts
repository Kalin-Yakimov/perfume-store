import { createHmac } from "node:crypto"
import {
  createStorefrontRevalidator,
  getStorefrontRevalidationConfig,
} from "../storefront-revalidation"
import { cacheResourcesForEvent, CATALOG_CHANGE_EVENTS } from "../catalog-events"

const settings = { url: "http://localhost:8000/api/revalidate", secret: "a".repeat(64) }
const environment = {
  STOREFRONT_REVALIDATION_URL: settings.url,
  STOREFRONT_REVALIDATION_SECRET: settings.secret,
}
const response = (status = 200) => new Response(null, { status })

describe("public resource mapping", () => {
  it("covers module/workflow mutations without sending personal data", () => {
    expect(new Set(CATALOG_CHANGE_EVENTS).size).toBe(CATALOG_CHANGE_EVENTS.length)
    expect(cacheResourcesForEvent("product.product-category.deleted")).toEqual(["products", "variants", "categories", "collections"])
    expect(cacheResourcesForEvent("product.updated")).toEqual(["products", "variants", "categories", "collections"])
    expect(cacheResourcesForEvent("product-collection.created")).toContain("collections")
    expect(cacheResourcesForEvent("pricing.price.updated")).toEqual(["products", "variants", "categories", "collections"])
    expect(cacheResourcesForEvent("inventory.reservation-item.deleted")).toEqual(["products", "variants", "categories", "collections"])
    expect(cacheResourcesForEvent("region.region.updated")).toContain("payment_providers")
    expect(cacheResourcesForEvent("translation.locale.deleted")).toContain("locales")
    expect(cacheResourcesForEvent("perfumeTaxonomy.perfume-taxonomy.updated")).toContain("perfume_taxonomies")
    expect(cacheResourcesForEvent("order.canceled")).toEqual(["products", "variants", "categories", "collections"])
    expect(cacheResourcesForEvent("customer.updated")).toEqual([])
    expect(cacheResourcesForEvent("cart.updated")).toEqual([])
    expect(cacheResourcesForEvent("untrusted.arbitrary-event")).toEqual([])
  })
})

describe("webhook configuration", () => {
  it("is disabled only when neither optional variable is configured", () => {
    expect(getStorefrontRevalidationConfig({})).toBeNull()
    expect(getStorefrontRevalidationConfig(environment)).toEqual(settings)
    expect(() => getStorefrontRevalidationConfig({ STOREFRONT_REVALIDATION_URL: settings.url })).toThrow()
    expect(() => getStorefrontRevalidationConfig({ STOREFRONT_REVALIDATION_SECRET: settings.secret })).toThrow()
  })

  it.each([
    "https://user:password@example.invalid/api/revalidate",
    "https://example.invalid/api/revalidate?secret=hidden",
    "https://example.invalid/api/revalidate#fragment",
    "https://example.invalid/arbitrary-route",
    "http://remote.example.invalid/api/revalidate",
    "ftp://example.invalid/api/revalidate",
    "not-a-url",
  ])("rejects unsafe endpoint %s", (url) => {
    expect(() => getStorefrontRevalidationConfig({ ...environment, STOREFRONT_REVALIDATION_URL: url })).toThrow()
  })

  it("requires HTTPS in production and rejects weak/reused authentication secrets", () => {
    expect(() => getStorefrontRevalidationConfig({ ...environment, NODE_ENV: "production" })).toThrow()
    expect(getStorefrontRevalidationConfig({ ...environment, NODE_ENV: "production", STOREFRONT_REVALIDATION_URL: "https://store.example.invalid/api/revalidate" })?.url).toBe("https://store.example.invalid/api/revalidate")
    expect(() => getStorefrontRevalidationConfig({ ...environment, STOREFRONT_REVALIDATION_SECRET: "short" })).toThrow()
    expect(() => getStorefrontRevalidationConfig({ ...environment, STOREFRONT_REVALIDATION_SECRET: "REPLACE".repeat(10) })).toThrow()
    expect(() => getStorefrontRevalidationConfig({ ...environment, JWT_SECRET: settings.secret })).toThrow()
    expect(() => getStorefrontRevalidationConfig({ ...environment, COOKIE_SECRET: settings.secret })).toThrow()
    expect(() => getStorefrontRevalidationConfig({ ...environment, JWT_SECRET: ` ${settings.secret} ` })).toThrow()
  })
})

describe("batched signed cache notifications", () => {
  const now = () => 1_800_000_000_000
  const delay = async () => {}

  it("batches simultaneous resources and signs exact body bytes", async () => {
    const fetch = jest.fn().mockResolvedValue(response())
    const invalidate = createStorefrontRevalidator(settings, { fetch, now, delay })
    await Promise.all([invalidate(["products"]), invalidate(["variants", "products"]), invalidate(["categories"])])
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, request] = fetch.mock.calls[0]
    const payload = JSON.parse(request.body)
    expect(url).toBe(settings.url)
    expect(payload).toEqual({ version: 1, resources: ["categories", "products", "variants"] })
    const timestamp = request.headers["x-storefront-revalidation-timestamp"]
    expect(request.headers["x-storefront-revalidation-signature"]).toBe(createHmac("sha256", settings.secret).update(`${timestamp}.${request.body}`).digest("hex"))
    expect(request.redirect).toBe("error")
    expect(request.signal).toBeInstanceOf(AbortSignal)
    expect(request.body).not.toContain(settings.secret)
  })

  it("includes events that arrive while the first HTTP request is in flight", async () => {
    let finish: (value: Response) => void = () => {}
    const firstResponse = new Promise<Response>((resolve) => { finish = resolve })
    const fetch = jest.fn().mockReturnValueOnce(firstResponse).mockResolvedValue(response())
    const invalidate = createStorefrontRevalidator(settings, { fetch, now, delay })
    const first = invalidate(["products"])
    await Promise.resolve()
    const second = invalidate(["collections"])
    finish(response())
    await Promise.all([first, second])
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetch.mock.calls[1][1].body).resources).toEqual(["collections"])
  })

  it("does not block future notifications while a response stream cancellation is pending", async () => {
    const cancel = jest.fn().mockReturnValue(new Promise<void>(() => {}))
    const fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, body: { cancel } })
    const invalidate = createStorefrontRevalidator(settings, { fetch, now, delay })
    await invalidate(["products"])
    await invalidate(["variants"])
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(cancel).toHaveBeenCalledTimes(2)
  })

  it("retries transient server/network failures and starts new batches after success", async () => {
    const fetch = jest.fn().mockRejectedValueOnce(new Error("private network detail"))
      .mockResolvedValueOnce(response(503)).mockResolvedValue(response())
    const invalidate = createStorefrontRevalidator(settings, { fetch, now, delay })
    await invalidate(["products"])
    expect(fetch).toHaveBeenCalledTimes(3)
    await invalidate(["variants"])
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it("does not retry authentication errors and retains failed resources for the next event", async () => {
    const fetch = jest.fn().mockResolvedValueOnce(response(401)).mockResolvedValue(response())
    const invalidate = createStorefrontRevalidator(settings, { fetch, now, delay })
    await expect(invalidate(["products"])).rejects.toThrow("could not be delivered")
    expect(fetch).toHaveBeenCalledTimes(1)
    await invalidate(["categories"])
    expect(JSON.parse(fetch.mock.calls[1][1].body).resources).toEqual(["categories", "products"])
  })

  it("bounds retries and does not leak failure details", async () => {
    const fetch = jest.fn().mockRejectedValue(new Error("private URL or credential"))
    const invalidate = createStorefrontRevalidator(settings, { fetch, now, delay })
    await expect(invalidate(["products"])).rejects.toThrow("Storefront cache invalidation could not be delivered.")
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it("aborts an unresponsive server", async () => {
    jest.useFakeTimers()
    try {
      const fetch = jest.fn().mockImplementation((_url, request) => new Promise((_resolve, reject) => {
        request.signal.addEventListener("abort", () => reject(new Error("aborted")))
      }))
      const invalidate = createStorefrontRevalidator(settings, { fetch, now, delay })
      const result = expect(invalidate(["products"])).rejects.toThrow("could not be delivered")
      await jest.advanceTimersByTimeAsync(6000)
      await result
      expect(fetch).toHaveBeenCalledTimes(3)
    } finally {
      jest.useRealTimers()
    }
  })
})
