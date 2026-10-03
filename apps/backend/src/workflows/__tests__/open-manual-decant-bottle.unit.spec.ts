import type { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createStep } from "@medusajs/framework/workflows-sdk"

import { DECANT_STOCK_MODULE } from "../../modules/decant-stock"
import "../open-manual-decant-bottle"

jest.mock("@medusajs/framework/workflows-sdk", () => ({
  createStep: jest.fn(),
  createWorkflow: jest.fn(),
  StepResponse: class {
    constructor(public output: unknown) {}
  },
}))

jest.mock("../../modules/decant-stock/reservation", () => ({
  decantSourceLock: (id: string) => `decant-stock:${id}`,
}))

type Variant = {
  id: string
  product_id: string
  title: string
  metadata: { volume_ml: number }
  manage_inventory: boolean
  inventory_items: {
    inventory_item_id: string
    required_quantity: number
    inventory: {
      location_levels: {
        location_id: string
        stocked_quantity: number
        reserved_quantity: number
      }[]
    }
  }[]
}

type Invoke = (
  input: {
    source_product_id: string
    source_variant_id: string
    source_volume_ml: number
  },
  context: { container: MedusaContainer },
) => Promise<unknown>

const invoke = jest
  .mocked(createStep)
  .mock.calls.find(([id]) => id === "open-bottle")![1] as unknown as Invoke

function fixture(change?: (variant: Variant) => void) {
  const variant = (): Variant => ({
    id: "variant-1",
    product_id: "source-1",
    title: "100 ml",
    metadata: { volume_ml: 100 },
    manage_inventory: true,
    inventory_items: [
      {
        inventory_item_id: "inventory-1",
        required_quantity: 1,
        inventory: {
          location_levels: [
            {
              location_id: "warehouse-1",
              stocked_quantity: 2,
              reserved_quantity: 0,
            },
          ],
        },
      },
    ],
  })
  const changed = variant()
  change?.(changed)
  const query = {
    graph: jest
      .fn()
      .mockResolvedValueOnce({ data: [variant()] })
      .mockResolvedValueOnce({ data: [changed] }),
  }
  const inventory = { adjustInventory: jest.fn() }
  const stock = {
    createDecantBottles: jest.fn().mockResolvedValue({ id: "opened-1" }),
  }
  const locking = {
    execute: jest.fn(
      async (_keys: string[], operation: () => Promise<unknown>) => operation(),
    ),
  }
  const container = {
    resolve(key: string) {
      if (key === ContainerRegistrationKeys.QUERY) return query
      if (key === Modules.INVENTORY) return inventory
      if (key === Modules.LOCKING) return locking
      if (key === DECANT_STOCK_MODULE) return stock
      throw new Error(`Unexpected service ${key}`)
    },
  } as unknown as MedusaContainer
  const run = () =>
    invoke(
      {
        source_product_id: "source-1",
        source_variant_id: "variant-1",
        source_volume_ml: 100,
      },
      { container },
    )
  return { run, inventory, stock, locking }
}

describe("manual bottle opening current-state validation", () => {
  it("opens unchanged source stock under its source and inventory locks", async () => {
    const f = fixture()
    await f.run()
    expect(f.inventory.adjustInventory).toHaveBeenCalledWith(
      "inventory-1",
      "warehouse-1",
      -1,
    )
    expect(f.stock.createDecantBottles).toHaveBeenCalledWith(
      expect.objectContaining({ source_volume_ml: 100, remaining_ml: 95 }),
    )
    expect(f.locking.execute.mock.calls[0][0]).toEqual([
      "decant-stock:source-1",
      "inventory-1",
    ])
  })

  it.each<[(variant: Variant) => void]>([
    [
      (variant) => {
        variant.metadata.volume_ml = 50
      },
    ],
    [
      (variant) => {
        variant.product_id = "other-source"
      },
    ],
    [
      (variant) => {
        variant.manage_inventory = false
      },
    ],
    [
      (variant) => {
        variant.inventory_items[0].inventory_item_id = "other-inventory"
      },
    ],
    [
      (variant) => {
        variant.inventory_items[0].required_quantity = 2
      },
    ],
    [
      (variant) => {
        variant.inventory_items = []
      },
    ],
  ])(
    "does not open stale stock if the variant changed while waiting",
    async (change) => {
      const f = fixture(change)
      await expect(f.run()).rejects.toThrow("беше променена")
      expect(f.inventory.adjustInventory).not.toHaveBeenCalled()
      expect(f.stock.createDecantBottles).not.toHaveBeenCalled()
    },
  )
})
