import type { SubscriberArgs } from "@medusajs/framework"
import { notifyStorefrontCache } from "../notify-storefront-cache"

const envKeys = [
  "STOREFRONT_REVALIDATION_SECRET",
  "STOREFRONT_REVALIDATION_URL",
] as const
const previous = Object.fromEntries(
  envKeys.map((key) => [key, process.env[key]]),
)

describe("best-effort storefront cache notification", () => {
  afterEach(() => {
    jest.restoreAllMocks()
    for (const key of envKeys) {
      const value = previous[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  const makeArgs = (warn: jest.Mock) => ({
    event: { name: "product.product.updated", data: { id: "prod_test" } },
    container: { resolve: jest.fn().mockReturnValue({ warn }) },
  }) as unknown as SubscriberArgs

  it("does nothing when optional notification settings are absent", async () => {
    delete process.env.STOREFRONT_REVALIDATION_SECRET
    delete process.env.STOREFRONT_REVALIDATION_URL
    const fetch = jest.spyOn(globalThis, "fetch")
    const warn = jest.fn()

    await expect(notifyStorefrontCache(makeArgs(warn))).resolves.toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })

  it("does not fail completed backend work when delivery fails and limits warnings", async () => {
    process.env.STOREFRONT_REVALIDATION_SECRET = "test-only-cache-key-not-for-deployment-0123456789"
    process.env.STOREFRONT_REVALIDATION_URL = "http://localhost:8000/api/revalidate"
    const fetch = jest.spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Test-only network failure"))
    const warn = jest.fn()
    const args = makeArgs(warn)

    await expect(notifyStorefrontCache(args)).resolves.toBeUndefined()
    await expect(notifyStorefrontCache(args)).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledTimes(6)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      "Storefront cache sync is unavailable or misconfigured; public cache TTL remains the fallback.",
    )
  })
})
