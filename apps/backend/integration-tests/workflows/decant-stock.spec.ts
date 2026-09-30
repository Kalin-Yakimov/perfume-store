import type { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  createStockLocationsWorkflow,
} from "@medusajs/medusa/core-flows"

import { canFulfillCartDecants, maxAdditionalDecantQuantity } from "../../src/modules/decant-stock/cart-preview"
import { DECANT_STOCK_MODULE } from "../../src/modules/decant-stock"
import DecantStockModuleService from "../../src/modules/decant-stock/service"
import { reserveDecantSource, releaseDecantAllocations } from "../../src/modules/decant-stock/reservation"
import type { SourceRequest } from "../../src/modules/decant-stock/stock"
import { prepareDecantOrderWorkflow } from "../../src/workflows/prepare-decant-order"
import linkDecantsToOrder from "../../src/subscribers/link-decants-to-order"
import releaseDecantsOnOrderCanceled from "../../src/subscribers/release-decants-on-order-canceled"

jest.setTimeout(120_000)

type Fixture = {
  sourceProductId: string
  sourceVariantId: string
  inventoryItemId: string
  locationId: string
  decantProductId: string
  decantVariantId: string
}

const makeRequest = (
  fixture: Fixture,
  quantity: number,
  volumeMl = 10,
): SourceRequest => ({
  sourceProductId: fixture.sourceProductId,
  sourceVariantId: fixture.sourceVariantId,
  sourceVolumeMl: 100,
  units: Array.from({ length: quantity }, () => ({
    variantId: fixture.decantVariantId,
    volumeMl,
  })),
})

const createScopedContainer = (
  container: MedusaContainer,
  overrides: Map<string, unknown>,
) => ({
  resolve(key: string) {
    return overrides.has(key) ? overrides.get(key) : container.resolve(key)
  },
}) as MedusaContainer

medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    let fixture: Fixture

    beforeAll(async () => {
      const container = getContainer()
      const query = container.resolve(ContainerRegistrationKeys.QUERY)

      const { result: locations } = await createStockLocationsWorkflow(container).run({
        input: { locations: [{ name: "Integration Test Warehouse" }] },
      })
      const locationId = locations[0].id

      const { result: sourceProducts } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "Integration Perfume 100 мл",
              handle: "integration-perfume-100-ml",
              status: "published",
              metadata: { listing_type: "full_perfume", brand: "Integration Test" },
              options: [{ title: "Volume", values: ["100 мл"] }],
              variants: [
                {
                  title: "100 мл",
                  sku: "INTEGRATION-PERFUME-100-ML",
                  metadata: { volume_ml: 100 },
                  manage_inventory: true,
                  options: { Volume: "100 мл" },
                  prices: [{ amount: 20, currency_code: "eur" }],
                },
              ],
            },
          ],
        },
      })
      const sourceProduct = sourceProducts[0]
      const sourceVariant = sourceProduct.variants[0]

      const { data: variants } = await query.graph({
        entity: "product_variant",
        filters: { id: sourceVariant.id },
        fields: ["id", "product_id", "inventory_items.inventory_item_id"],
      })
      const inventoryItemId = variants[0]?.inventory_items?.[0]?.inventory_item_id
      if (!inventoryItemId) {
        throw new Error("Integration fixture did not create a source inventory item")
      }

      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: [
            {
              inventory_item_id: inventoryItemId,
              location_id: locationId,
              stocked_quantity: 1,
            },
          ],
        },
      })

      const { result: decantProducts } = await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "Integration Perfume — Отливка",
              handle: "integration-perfume-decant",
              status: "published",
              metadata: {
                listing_type: "decant",
                decant_enabled: true,
                catalog_visible: true,
              },
              options: [{ title: "Volume", values: ["10 мл"] }],
              variants: [
                {
                  title: "10 мл",
                  sku: "INTEGRATION-PERFUME-DECANT-10-ML",
                  manage_inventory: false,
                  options: { Volume: "10 мл" },
                  prices: [{ amount: 3, currency_code: "eur" }],
                },
              ],
            },
          ],
        },
      })
      const decantProduct = decantProducts[0]
      const decantVariant = decantProduct.variants[0]

      await container.resolve(Modules.PRODUCT).updateProducts(decantProduct.id, {
        metadata: {
          ...decantProduct.metadata,
          decant_source_product_id: sourceProduct.id,
          decant_source_variant_id: sourceVariant.id,
          decant_source_volume_ml: 100,
          decant_variant_volumes: { [decantVariant.id]: 10 },
          decant_enabled_variant_ids: [decantVariant.id],
        },
      })

      fixture = {
        sourceProductId: sourceProduct.id,
        sourceVariantId: sourceVariant.id,
        inventoryItemId,
        locationId,
        decantProductId: decantProduct.id,
        decantVariantId: decantVariant.id,
      }
    })

    const getInventoryLevel = async () => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "product_variant",
          filters: { id: fixture.sourceVariantId },
          fields: [
            "inventory_items.inventory.location_levels.stocked_quantity",
            "inventory_items.inventory.location_levels.reserved_quantity",
          ],
        })
      const level = data[0]?.inventory_items?.[0]?.inventory?.location_levels?.[0]
      if (!level) {
        throw new Error("Integration fixture is missing its inventory level")
      }
      return level
    }

    it("checks a combined bottle-and-decant cart against real product and inventory records", async () => {
      const container = getContainer()
      const nineDecants = [
        {
          product_id: fixture.decantProductId,
          variant_id: fixture.decantVariantId,
          quantity: 9,
        },
      ]

      await expect(canFulfillCartDecants(container, nineDecants)).resolves.toBe(true)
      await expect(
        maxAdditionalDecantQuantity(
          container,
          [],
          fixture.decantProductId,
          fixture.decantVariantId,
        ),
      ).resolves.toBe(9)
      await expect(
        maxAdditionalDecantQuantity(
          container,
          [{ ...nineDecants[0], quantity: 8 }],
          fixture.decantProductId,
          fixture.decantVariantId,
        ),
      ).resolves.toBe(1)
      await expect(
        canFulfillCartDecants(container, [
          { ...nineDecants[0], quantity: 10 },
        ]),
      ).resolves.toBe(false)
      await expect(
        canFulfillCartDecants(container, [
          { variant_id: fixture.sourceVariantId, quantity: 1 },
          { ...nineDecants[0], quantity: 1 },
        ]),
      ).resolves.toBe(false)
    })

    it("rejects a checkout over the bottle limit without leaving partial reservations", async () => {
      const container = getContainer()
      const stock: DecantStockModuleService = container.resolve(DECANT_STOCK_MODULE)

      await expect(
        reserveDecantSource(container, "over-limit-cart", makeRequest(fixture, 10)),
      ).rejects.toThrow()

      await expect(
        stock.listDecantAllocations({ cart_id: "over-limit-cart" }),
      ).resolves.toHaveLength(0)
      const level = await getInventoryLevel()
      expect(Number(level.reserved_quantity)).toBe(0)
    })

    it("serializes simultaneous checkouts competing for the same sealed bottle", async () => {
      const container = getContainer()
      const stock: DecantStockModuleService = container.resolve(DECANT_STOCK_MODULE)
      const attempts = await Promise.allSettled([
        reserveDecantSource(container, "race-cart-a", makeRequest(fixture, 9)),
        reserveDecantSource(container, "race-cart-b", makeRequest(fixture, 9)),
      ])

      expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1)
      expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1)
      const allocations = await stock.listDecantAllocations({ status: "reserved" })
      expect(allocations).toHaveLength(9)
      const level = await getInventoryLevel()
      expect(Number(level.reserved_quantity)).toBe(1)
    })

    it("links order allocations idempotently when the order-created event is repeated", async () => {
      const container = getContainer()
      const stock: DecantStockModuleService = container.resolve(DECANT_STOCK_MODULE)
      const cartId = "placed-order-cart"
      const orderId = "placed-order"
      await reserveDecantSource(container, cartId, makeRequest(fixture, 2))

      const query = {
        graph: jest.fn(async () => ({ data: [{ cart_id: cartId }] })),
      }
      const scopedContainer = createScopedContainer(
        container,
        new Map([[ContainerRegistrationKeys.QUERY, query]]),
      )
      const event = {
        event: { name: "order.placed", eventName: "order.placed", data: { id: orderId } },
        container: scopedContainer,
        pluginOptions: {},
      }

      await linkDecantsToOrder(event)
      await linkDecantsToOrder(event)

      const allocations = await stock.listDecantAllocations({ cart_id: cartId })
      expect(allocations).toHaveLength(2)
      expect(allocations.every((allocation) => allocation.order_id === orderId)).toBe(true)
      expect(allocations.every((allocation) => allocation.status === "reserved")).toBe(true)
    })

    it("releases canceled-order reservations once and makes the sealed bottle available again", async () => {
      const container = getContainer()
      const stock: DecantStockModuleService = container.resolve(DECANT_STOCK_MODULE)
      const cartId = "canceled-order-cart"
      const orderId = "canceled-order"
      await reserveDecantSource(container, cartId, makeRequest(fixture, 2))
      const query = {
        graph: jest.fn(async () => ({ data: [{ cart_id: cartId }] })),
      }
      const scopedContainer = createScopedContainer(
        container,
        new Map<string, unknown>([[ContainerRegistrationKeys.QUERY, query]]),
      )

      const event = {
        event: { name: "order.canceled", eventName: "order.canceled", data: { id: orderId } },
        container: scopedContainer,
        pluginOptions: {},
      }
      await releaseDecantsOnOrderCanceled(event)
      await releaseDecantsOnOrderCanceled(event)

      const released = await stock.listDecantAllocations({ cart_id: cartId })
      expect(released).toHaveLength(2)
      expect(released.every((allocation) => allocation.status === "released")).toBe(true)
      const plans = await stock.listDecantPlannedBottles({ source_product_id: fixture.sourceProductId })
      expect(plans).toHaveLength(1)
      expect(plans[0].status).toBe("released")
      const level = await getInventoryLevel()
      expect(Number(level.reserved_quantity)).toBe(0)
    })

    it("opens one reserved bottle during preparation and cannot deduct the same vials twice", async () => {
      const container = getContainer()
      const stock: DecantStockModuleService = container.resolve(DECANT_STOCK_MODULE)
      const cartId = "prepared-order-cart"
      const order = await container.resolve(Modules.ORDER).createOrders({
        currency_code: "eur",
        status: "pending",
      })
      const orderId = order.id
      await reserveDecantSource(container, cartId, makeRequest(fixture, 9))
      const reserved = await stock.listDecantAllocations({ cart_id: cartId, status: "reserved" })
      await Promise.all(
        reserved.map((allocation) =>
          stock.updateDecantAllocations({ id: allocation.id, order_id: orderId }),
        ),
      )

      const first = await prepareDecantOrderWorkflow(container).run({
        input: { order_id: orderId },
      })
      expect(first.result).toEqual({ prepared_vials: 9, opened_bottles: 1 })

      const opened = await stock.listDecantBottles({
        source_product_id: fixture.sourceProductId,
        status: "active",
      })
      expect(opened).toHaveLength(1)
      expect(Number(opened[0].remaining_ml)).toBe(5)
      const prepared = await stock.listDecantAllocations({ order_id: orderId })
      expect(prepared).toHaveLength(9)
      expect(prepared.every((allocation) => allocation.status === "prepared")).toBe(true)

      const second = await prepareDecantOrderWorkflow(container).run({
        input: { order_id: orderId },
      })
      expect(second.result).toEqual({ prepared_vials: 0, opened_bottles: 0 })
      const adjustments = await stock.listDecantAdjustments({ order_id: orderId })
      expect(adjustments).toHaveLength(1)
      expect(Number(adjustments[0].change_ml)).toBe(-90)
      const level = await getInventoryLevel()
      expect(Number(level.stocked_quantity)).toBe(0)
      expect(Number(level.reserved_quantity)).toBe(0)
    })

    it("does not touch inventory if preparation is attempted after cancellation", async () => {
      const container = getContainer()
      const stock: DecantStockModuleService = container.resolve(DECANT_STOCK_MODULE)
      const cartId = "canceled-before-prepare-cart"
      const order = await container.resolve(Modules.ORDER).createOrders({
        currency_code: "eur",
        status: "canceled",
      })
      const orderId = order.id
      await reserveDecantSource(container, cartId, makeRequest(fixture, 1))
      const [allocation] = await stock.listDecantAllocations({
        cart_id: cartId,
        status: "reserved",
      })
      await stock.updateDecantAllocations({ id: allocation.id, order_id: orderId })

      await expect(
        prepareDecantOrderWorkflow(container).run({
          input: { order_id: orderId },
        }),
      ).rejects.toThrow("Отказана поръчка не може да бъде приготвена.")

      const reservedAllocation = await stock.listDecantAllocations({ order_id: orderId })
      expect(reservedAllocation).toHaveLength(1)
      expect(reservedAllocation[0].status).toBe("reserved")
      const level = await getInventoryLevel()
      expect(Number(level.reserved_quantity)).toBe(1)
      expect(Number(level.stocked_quantity)).toBe(1)
    })
  },
})
