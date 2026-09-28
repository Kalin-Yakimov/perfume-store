import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework"

import { canFulfillCartDecants } from "../cart-preview"
import { DECANT_STOCK_MODULE } from "../index"

const createContainer = ({ sealedUnits, openRemainingMl = 0 }: {
  sealedUnits: number
  openRemainingMl?: number
}) => {
  const decantProduct = {
    id: "decant-product",
    status: "published",
    metadata: {
      listing_type: "decant",
      decant_enabled: true,
      catalog_visible: true,
      decant_source_product_id: "perfume-product",
      decant_source_variant_id: "whole-100",
      decant_source_volume_ml: 100,
      decant_variant_volumes: { "decant-10": 10 },
      decant_enabled_variant_ids: ["decant-10"],
    },
  }
  const productService = {
    listProducts: jest.fn(async () => [decantProduct]),
    listProductVariants: jest.fn(async ({ id }: { id: string[] }) =>
      id.includes("whole-100")
        ? [{ id: "whole-100", product_id: "perfume-product" }]
        : [],
    ),
  }
  const stockService = {
    listDecantBottles: jest.fn(async () =>
      openRemainingMl > 0
        ? [{ id: "open-bottle", remaining_ml: openRemainingMl }]
        : [],
    ),
    listDecantPlannedBottles: jest.fn(async () => []),
    listDecantAllocations: jest.fn(async () => []),
  }
  const query = {
    graph: jest.fn(async () => ({
      data: [
        {
          id: "whole-100",
          product_id: "perfume-product",
          title: "100 мл",
          manage_inventory: true,
          metadata: { volume_ml: 100 },
          inventory_items: [
            {
              inventory_item_id: "inventory-whole",
              required_quantity: 1,
              inventory: {
                location_levels: [
                  {
                    location_id: "main-location",
                    stocked_quantity: sealedUnits,
                    reserved_quantity: 0,
                    stock_locations: [{ sales_channels: [{ id: "sales-channel" }] }],
                  },
                ],
              },
            },
          ],
        },
      ],
    })),
  }

  const container = {
    resolve: (key: string) => {
      if (key === Modules.PRODUCT) return productService
      if (key === DECANT_STOCK_MODULE) return stockService
      if (key === ContainerRegistrationKeys.QUERY) return query
      throw new Error(`Unexpected service requested: ${key}`)
    },
  } as unknown as MedusaContainer

  return { container }
}

describe("decant cart stock preview", () => {
  it("accepts vials that fit within the usable volume of a sealed bottle", async () => {
    const { container } = createContainer({ sealedUnits: 1 })
    await expect(
      canFulfillCartDecants(
        container,
        [{ product_id: "decant-product", variant_id: "decant-10", quantity: 9 }],
        "sales-channel",
      ),
    ).resolves.toBe(true)
  })

  it("rejects a quantity that exceeds the usable volume", async () => {
    const { container } = createContainer({ sealedUnits: 1 })
    await expect(
      canFulfillCartDecants(
        container,
        [{ product_id: "decant-product", variant_id: "decant-10", quantity: 10 }],
        "sales-channel",
      ),
    ).resolves.toBe(false)
  })

  it("uses an additional sealed bottle when one cannot fulfill the whole order", async () => {
    const { container } = createContainer({ sealedUnits: 2 })
    await expect(
      canFulfillCartDecants(
        container,
        [{ product_id: "decant-product", variant_id: "decant-10", quantity: 11 }],
        "sales-channel",
      ),
    ).resolves.toBe(true)
  })

  it("uses open stock and counts whole bottles in the same cart", async () => {
    const withOpenStock = createContainer({ sealedUnits: 0, openRemainingMl: 20 })
    await expect(
      canFulfillCartDecants(
        withOpenStock.container,
        [{ product_id: "decant-product", variant_id: "decant-10", quantity: 2 }],
        "sales-channel",
      ),
    ).resolves.toBe(true)

    const mixedCart = createContainer({ sealedUnits: 1 })
    await expect(
      canFulfillCartDecants(
        mixedCart.container,
        [
          { product_id: "decant-product", variant_id: "decant-10", quantity: 1 },
          { variant_id: "whole-100", quantity: 1 },
        ],
        "sales-channel",
      ),
    ).resolves.toBe(false)
  })
})
