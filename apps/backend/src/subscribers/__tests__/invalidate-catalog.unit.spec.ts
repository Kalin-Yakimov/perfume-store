import type { SubscriberArgs } from "@medusajs/framework"
import invalidateCatalog, { config } from "../invalidate-catalog"
import { invalidateCatalogWorkflow } from "../../workflows/invalidate-catalog"
import { notifyStorefrontCache } from "../../lib/notify-storefront-cache"

// Inspect event subscriptions without constructing the workflow or its modules.
jest.mock("../../workflows/invalidate-catalog", () => ({
  invalidateCatalogWorkflow: jest.fn(),
}))
jest.mock("../../lib/notify-storefront-cache", () => ({
  notifyStorefrontCache: jest.fn(),
}))

const events = Array.isArray(config.event) ? config.event : [config.event]

describe("ordered backend and storefront cache invalidation", () => {
  const args = {
    event: { name: "product.product.updated", data: { id: "prod_test" } },
    container: {},
  } as SubscriberArgs

  beforeEach(() => jest.resetAllMocks())

  it("waits for backend invalidation before notifying the storefront", async () => {
    let finishBackend!: () => void
    const backend = new Promise<void>((resolve) => { finishBackend = resolve })
    const run = jest.fn().mockReturnValue(backend)
    jest.mocked(invalidateCatalogWorkflow).mockReturnValue({ run } as never)
    jest.mocked(notifyStorefrontCache).mockResolvedValue(undefined)

    const pending = invalidateCatalog(args)
    expect(run).toHaveBeenCalledWith({ input: {} })
    await Promise.resolve()
    expect(notifyStorefrontCache).not.toHaveBeenCalled()

    finishBackend()
    await pending
    expect(notifyStorefrontCache).toHaveBeenCalledTimes(1)
    expect(notifyStorefrontCache).toHaveBeenCalledWith(args)
  })

  it("does not evict the storefront when backend invalidation fails", async () => {
    const run = jest.fn().mockRejectedValue(new Error("Test-only index failure"))
    jest.mocked(invalidateCatalogWorkflow).mockReturnValue({ run } as never)

    await expect(invalidateCatalog(args)).rejects.toThrow("Test-only index failure")
    expect(notifyStorefrontCache).not.toHaveBeenCalled()
  })
})

describe("catalog invalidation subscriptions", () => {
  it("subscribes to the exact Medusa namespaces for product, inventory, and pricing changes", () => {
    expect(events).toEqual(expect.arrayContaining([
      "product.product.created",
      "product.product.updated",
      "product.product.deleted",
      "product.product-variant.created",
      "product.product-variant.updated",
      "product.product-variant.deleted",
      "product.product-option-value.updated",
      "product.product-category.updated",
      "product.product-collection.updated",
      "inventory.inventory-item.updated",
      "inventory.inventory-level.created",
      "inventory.inventory-level.updated",
      "inventory.inventory-level.deleted",
      "inventory.reservation-item.created",
      "inventory.reservation-item.updated",
      "inventory.reservation-item.deleted",
      "pricing.price.created",
      "pricing.price.updated",
      "pricing.price.deleted",
      "pricing.price-list.created",
      "pricing.price-list.updated",
      "pricing.price-list.deleted",
      "region.region.updated",
      "region.region.deleted",
    ]))
  })

  it("subscribes to all stock and taxonomy mutations under their registered module names", () => {
    expect(events.filter((event) => event.startsWith("decantStock.") || event.startsWith("perfumeTaxonomy.")).sort()).toEqual([
      "decantStock.decant-bottle.created",
      "decantStock.decant-bottle.updated",
      "decantStock.decant-bottle.deleted",
      "decantStock.decant-bottle.restored",
      "decantStock.decant-allocation.created",
      "decantStock.decant-allocation.updated",
      "decantStock.decant-allocation.deleted",
      "decantStock.decant-allocation.restored",
      "decantStock.decant-planned-bottle.created",
      "decantStock.decant-planned-bottle.updated",
      "decantStock.decant-planned-bottle.deleted",
      "decantStock.decant-planned-bottle.restored",
      "perfumeTaxonomy.perfume-taxonomy.created",
      "perfumeTaxonomy.perfume-taxonomy.updated",
      "perfumeTaxonomy.perfume-taxonomy.deleted",
      "perfumeTaxonomy.perfume-taxonomy.restored",
    ].sort())
  })
})
