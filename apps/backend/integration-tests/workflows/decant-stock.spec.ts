import type { MedusaContainer } from "@medusajs/framework"
import { asValue } from "@medusajs/framework/awilix"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  createStockLocationsWorkflow,
} from "@medusajs/medusa/core-flows"

import {
  canFulfillCartDecants,
  maxAdditionalDecantQuantity,
} from "../../src/modules/decant-stock/cart-preview"
import { DECANT_STOCK_MODULE } from "../../src/modules/decant-stock"
import DecantStockModuleService from "../../src/modules/decant-stock/service"
import {
  reserveDecantSource,
  releaseDecantAllocations,
} from "../../src/modules/decant-stock/reservation"
import type { SourceRequest } from "../../src/modules/decant-stock/stock"
import { prepareDecantOrderWorkflow } from "../../src/workflows/prepare-decant-order"
import linkDecantsToOrder from "../../src/subscribers/link-decants-to-order"
import releaseDecantsOnOrderCanceled from "../../src/subscribers/release-decants-on-order-canceled"
import { GET as getLinkedDecants } from "../../src/api/store/linked-decants/route"
import { PERFUME_TAXONOMY_MODULE } from "../../src/modules/perfume-taxonomy"
import PerfumeTaxonomyModuleService from "../../src/modules/perfume-taxonomy/service"
import { updatePerfumeTaxonomyWorkflow } from "../../src/workflows/update-perfume-taxonomy"
import { deletePerfumeTaxonomyWorkflow } from "../../src/workflows/delete-perfume-taxonomy"
import { upsertPerfumeTaxonomyWorkflow } from "../../src/workflows/upsert-perfume-taxonomy"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { assertPerfumeTaxonomyUnused } from "../../src/lib/perfume-taxonomy-references"
import { GET as getOrderDecants } from "../../src/api/admin/orders/[id]/decants/route"

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
) => {
  // Workflow execution copies Awilix registrations, not a resolve-only wrapper.
  const scoped = container.createScope() as MedusaContainer
  for (const [key, value] of overrides) scoped.register(key, asValue(value))
  return scoped
}

medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    let fixture: Fixture

    it("queries only linked published/visible decants, regardless of their catalog position", async () => {
      const container = getContainer()
      const products = container.resolve(Modules.PRODUCT)
      await products.createProducts(
        Array.from({ length: 110 }, (_, i) => ({
          title: `Unrelated ${i}`,
          handle: `catalog-unrelated-${i}`,
          status: "published",
        })),
      )
      const [linked] = await products.createProducts([
        {
          title: "Linked decant",
          handle: "catalog-linked-decant",
          status: "published",
          metadata: {
            listing_type: "decant",
            catalog_visible: true,
            decant_source_product_id: fixture.sourceProductId,
          },
        },
        {
          title: "Hidden decant",
          handle: "catalog-hidden-decant",
          status: "published",
          metadata: {
            listing_type: "decant",
            catalog_visible: false,
            decant_source_product_id: fixture.sourceProductId,
          },
        },
        {
          title: "Other source",
          handle: "catalog-other-source",
          status: "published",
          metadata: {
            listing_type: "decant",
            catalog_visible: true,
            decant_source_product_id: "other",
          },
        },
      ])
      const json = jest.fn()
      await getLinkedDecants(
        {
          scope: container,
          query: { source_product_id: fixture.sourceProductId },
        } as unknown as MedusaRequest,
        { json, setHeader: jest.fn() } as unknown as MedusaResponse,
      )
      const result = json.mock.calls[0][0]
      expect(result.product_ids).toContain(linked.id)
      expect(result.count).toBe(2) // Includes the fixture's linked decant as well.
      expect(result.product_ids).toHaveLength(2)
    })

    it("renames referenced designers/notes safely and blocks deletion until references are removed", async () => {
      const container = getContainer()
      const taxonomy: PerfumeTaxonomyModuleService = container.resolve(
        PERFUME_TAXONOMY_MODULE,
      )
      const designer = await taxonomy.createPerfumeTaxonomies({
        kind: "designer",
        name: "Old Brand",
        slug: "rename-test-brand",
        original_name: null,
        image_url: null,
      })
      const note = await taxonomy.createPerfumeTaxonomies({
        kind: "note",
        name: "Old Note",
        slug: "rename-test-note",
        original_name: null,
        image_url: null,
      })
      const products = container.resolve(Modules.PRODUCT)
      const entries = await products.createProducts([
        {
          title: "Old Brand Aroma",
          handle: "rename-bottle",
          status: "draft",
          metadata: {
            brand: designer.name,
            perfume_notes: [note.name],
            perfume_profile: {
              designer_id: designer.id,
              top_note_ids: [note.id],
              heart_note_ids: [],
              base_note_ids: [],
            },
          },
        },
        {
          title: "Old Brand Aroma — Отливки",
          handle: "rename-decant",
          status: "published",
          metadata: {
            brand: designer.name,
            perfume_notes: [note.name],
            perfume_profile: {
              designer_id: designer.id,
              top_note_ids: [note.id],
              heart_note_ids: [],
              base_note_ids: [],
            },
          },
        },
      ])
      await updatePerfumeTaxonomyWorkflow(container).run({
        input: { id: designer.id, name: "New Brand" },
      })
      await updatePerfumeTaxonomyWorkflow(container).run({
        input: { id: note.id, name: "New Note" },
      })
      for (const entry of entries) {
        const saved = await products.retrieveProduct(entry.id)
        expect(saved.title).toMatch(/^New Brand Aroma/)
        expect(saved.handle).toBe(entry.handle)
        expect(saved.metadata?.brand).toBe("New Brand")
        expect(saved.metadata?.perfume_notes).toEqual(["New Note"])
        expect(saved.metadata?.perfume_profile).toEqual(
          entry.metadata?.perfume_profile,
        )
      }
      await expect(
        assertPerfumeTaxonomyUnused(
          products,
          await taxonomy.retrievePerfumeTaxonomy(designer.id),
        ),
      ).rejects.toThrow("се използва")
      // Workflow errors are serialized by Medusa; match the error's message.
      await expect(
        deletePerfumeTaxonomyWorkflow(container).run({
          input: { id: designer.id },
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining("се използва"),
      })
      expect((await taxonomy.retrievePerfumeTaxonomy(designer.id)).name).toBe(
        "New Brand",
      )
      for (const entry of entries)
        await products.updateProducts(entry.id, {
          metadata: {
            perfume_profile: {
              designer_id: null,
              top_note_ids: [],
              heart_note_ids: [],
              base_note_ids: [],
            },
          },
        })
      await deletePerfumeTaxonomyWorkflow(container).run({
        input: { id: designer.id },
      })
      await expect(
        taxonomy.retrievePerfumeTaxonomy(designer.id),
      ).rejects.toThrow()
    })

    it("applies rename safety and label synchronization through the upsert path too", async () => {
      const container = getContainer()
      const input = {
        kind: "designer" as const,
        name: "Upsert Brand",
        slug: "upsert-test-brand",
        original_name: null,
        image_url: null,
      }
      const { result: created } = await upsertPerfumeTaxonomyWorkflow(
        container,
      ).run({ input })
      expect(created.created).toBe(true)
      const products = container.resolve(Modules.PRODUCT)
      const product = await products.createProducts({
        title: "Upsert Brand Aroma",
        handle: "upsert-bottle",
        metadata: {
          brand: input.name,
          perfume_profile: { designer_id: created.item.id },
        },
      })
      const { result: updated } = await upsertPerfumeTaxonomyWorkflow(
        container,
      ).run({
        input: { ...input, name: "Renamed Upsert Brand" },
      })
      expect(updated.created).toBe(false)
      expect(updated.item.id).toBe(created.item.id)
      expect((await products.retrieveProduct(product.id)).title).toBe(
        "Renamed Upsert Brand Aroma",
      )
      await products.createProducts({
        title: "Legacy reference",
        handle: "upsert-legacy-reference",
        metadata: { brand: updated.item.name },
      })
      await expect(
        upsertPerfumeTaxonomyWorkflow(container).run({
          input: { ...input, name: "Unsafe rename" },
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining("Първо изберете отново"),
      })
      const taxonomy: PerfumeTaxonomyModuleService = container.resolve(
        PERFUME_TAXONOMY_MODULE,
      )
      expect(
        (await taxonomy.retrievePerfumeTaxonomy(created.item.id)).name,
      ).toBe(updated.item.name)
    })

    it("restores the taxonomy name if planning product label updates fails", async () => {
      const container = getContainer()
      const taxonomy: PerfumeTaxonomyModuleService = container.resolve(
        PERFUME_TAXONOMY_MODULE,
      )
      const item = await taxonomy.createPerfumeTaxonomies({
        kind: "designer",
        name: "Rollback Brand",
        slug: "rollback-test-brand",
      })
      const list = jest
        .spyOn(taxonomy, "listPerfumeTaxonomies")
        .mockRejectedValueOnce(new Error("Test-only label planning failure"))
      try {
        await expect(
          updatePerfumeTaxonomyWorkflow(container).run({
            input: { id: item.id, name: "Must not remain" },
          }),
        ).rejects.toMatchObject({
          message: "Test-only label planning failure",
        })
      } finally {
        list.mockRestore()
      }
      expect((await taxonomy.retrievePerfumeTaxonomy(item.id)).name).toBe(
        "Rollback Brand",
      )
    })

    beforeAll(async () => {
      const container = getContainer()
      const query = container.resolve(ContainerRegistrationKeys.QUERY)

      const { result: locations } = await createStockLocationsWorkflow(
        container,
      ).run({
        input: { locations: [{ name: "Integration Test Warehouse" }] },
      })
      const locationId = locations[0].id

      const { result: sourceProducts } = await createProductsWorkflow(
        container,
      ).run({
        input: {
          products: [
            {
              title: "Integration Perfume 100 мл",
              handle: "integration-perfume-100-ml",
              status: "published",
              metadata: {
                listing_type: "full_perfume",
                brand: "Integration Test",
              },
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
      const inventoryItemId =
        variants[0]?.inventory_items?.[0]?.inventory_item_id
      if (!inventoryItemId) {
        throw new Error(
          "Integration fixture did not create a source inventory item",
        )
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

      const { result: decantProducts } = await createProductsWorkflow(
        container,
      ).run({
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

      await container
        .resolve(Modules.PRODUCT)
        .updateProducts(decantProduct.id, {
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
      const level =
        data[0]?.inventory_items?.[0]?.inventory?.location_levels?.[0]
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

      await expect(canFulfillCartDecants(container, nineDecants)).resolves.toBe(
        true,
      )
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
        canFulfillCartDecants(container, [{ ...nineDecants[0], quantity: 10 }]),
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
      const stock: DecantStockModuleService =
        container.resolve(DECANT_STOCK_MODULE)

      await expect(
        reserveDecantSource(
          container,
          "over-limit-cart",
          makeRequest(fixture, 10),
        ),
      ).rejects.toThrow()

      await expect(
        stock.listDecantAllocations({ cart_id: "over-limit-cart" }),
      ).resolves.toHaveLength(0)
      const level = await getInventoryLevel()
      expect(Number(level.reserved_quantity)).toBe(0)
    })

    it("serializes simultaneous checkouts competing for the same sealed bottle", async () => {
      const container = getContainer()
      const stock: DecantStockModuleService =
        container.resolve(DECANT_STOCK_MODULE)
      const attempts = await Promise.allSettled([
        reserveDecantSource(container, "race-cart-a", makeRequest(fixture, 9)),
        reserveDecantSource(container, "race-cart-b", makeRequest(fixture, 9)),
      ])

      expect(
        attempts.filter((attempt) => attempt.status === "fulfilled"),
      ).toHaveLength(1)
      expect(
        attempts.filter((attempt) => attempt.status === "rejected"),
      ).toHaveLength(1)
      const allocations = await stock.listDecantAllocations({
        status: "reserved",
      })
      expect(allocations).toHaveLength(9)
      const level = await getInventoryLevel()
      expect(Number(level.reserved_quantity)).toBe(1)
    })

    it("links order allocations idempotently when the order-created event is repeated", async () => {
      const container = getContainer()
      const stock: DecantStockModuleService =
        container.resolve(DECANT_STOCK_MODULE)
      const cartId = "placed-order-cart"
      const orderId = "placed-order"
      await reserveDecantSource(container, cartId, makeRequest(fixture, 2))

      const query = {
        graph: jest.fn(async ({ entity }: { entity: string }) => ({
          data:
            entity === "order"
              ? [{ id: orderId, status: "pending", canceled_at: null }]
              : [{ cart_id: cartId }],
        })),
      }
      const scopedContainer = createScopedContainer(
        container,
        new Map([[ContainerRegistrationKeys.QUERY, query]]),
      )
      const event = {
        event: {
          name: "order.placed",
          eventName: "order.placed",
          data: { id: orderId },
        },
        container: scopedContainer,
        pluginOptions: {},
      }

      await linkDecantsToOrder(event)
      await linkDecantsToOrder(event)

      const allocations = await stock.listDecantAllocations({
        cart_id: cartId,
      })
      expect(allocations).toHaveLength(2)
      expect(
        allocations.every((allocation) => allocation.order_id === orderId),
      ).toBe(true)
      expect(
        allocations.every((allocation) => allocation.status === "reserved"),
      ).toBe(true)
    })

    it("releases canceled-order reservations once and makes the sealed bottle available again", async () => {
      const container = getContainer()
      const stock: DecantStockModuleService =
        container.resolve(DECANT_STOCK_MODULE)
      const cartId = "canceled-order-cart"
      const orderId = "canceled-order"
      await reserveDecantSource(container, cartId, makeRequest(fixture, 2))
      const query = {
        graph: jest.fn(async ({ entity }: { entity: string }) => ({
          data:
            entity === "order"
              ? [{ id: orderId, status: "canceled", canceled_at: new Date() }]
              : [{ cart_id: cartId }],
        })),
      }
      const scopedContainer = createScopedContainer(
        container,
        new Map<string, unknown>([[ContainerRegistrationKeys.QUERY, query]]),
      )

      const event = {
        event: {
          name: "order.canceled",
          eventName: "order.canceled",
          data: { id: orderId },
        },
        container: scopedContainer,
        pluginOptions: {},
      }
      await releaseDecantsOnOrderCanceled(event)
      await releaseDecantsOnOrderCanceled(event)

      const released = await stock.listDecantAllocations({ cart_id: cartId })
      expect(released).toHaveLength(2)
      expect(
        released.every((allocation) => allocation.status === "released"),
      ).toBe(true)
      const plans = await stock.listDecantPlannedBottles({
        source_product_id: fixture.sourceProductId,
      })
      expect(plans).toHaveLength(1)
      expect(plans[0].status).toBe("released")
      const level = await getInventoryLevel()
      expect(Number(level.reserved_quantity)).toBe(0)
    })

    it("releases every vial from a partially linked canceled order and ignores a delayed placed event", async () => {
      const container = getContainer()
      const stock: DecantStockModuleService =
        container.resolve(DECANT_STOCK_MODULE)
      const cartId = "partially-linked-cancel-cart"
      const orderId = "partially-linked-cancel-order"
      const ids = await reserveDecantSource(
        container,
        cartId,
        makeRequest(fixture, 2),
      )
      await stock.updateDecantAllocations({ id: ids[0], order_id: orderId })
      const query = {
        graph: jest.fn(async ({ entity }: { entity: string }) => ({
          data:
            entity === "order"
              ? [{ id: orderId, status: "canceled", canceled_at: new Date() }]
              : [{ cart_id: cartId }],
        })),
      }
      const scopedContainer = createScopedContainer(
        container,
        new Map<string, unknown>([[ContainerRegistrationKeys.QUERY, query]]),
      )
      const event = {
        event: {
          name: "order.canceled",
          eventName: "order.canceled",
          data: { id: orderId },
        },
        container: scopedContainer,
        pluginOptions: {},
      }
      await releaseDecantsOnOrderCanceled(event)
      await linkDecantsToOrder({
        ...event,
        event: {
          ...event.event,
          name: "order.placed",
        },
      })
      const allocations = await stock.listDecantAllocations({
        cart_id: cartId,
      })
      expect(
        allocations.every((allocation) => allocation.status === "released"),
      ).toBe(true)
      expect(
        allocations.find((allocation) => allocation.id === ids[1])?.order_id,
      ).toBeNull()
      expect(Number((await getInventoryLevel()).reserved_quantity)).toBe(0)
    })

    it("restores inventory and all vial statuses if cancellation cleanup fails, then retries safely", async () => {
      const container = getContainer()
      const stock: DecantStockModuleService =
        container.resolve(DECANT_STOCK_MODULE)
      const cartId = "release-rollback-cart"
      const orderId = "release-rollback-order"
      await reserveDecantSource(container, cartId, makeRequest(fixture, 2))
      const query = {
        graph: jest.fn(async ({ entity }: { entity: string }) => ({
          data:
            entity === "order"
              ? [{ id: orderId, status: "canceled", canceled_at: new Date() }]
              : [{ cart_id: cartId }],
        })),
      }
      const scopedContainer = createScopedContainer(
        container,
        new Map<string, unknown>([[ContainerRegistrationKeys.QUERY, query]]),
      )
      const event = {
        event: {
          name: "order.canceled",
          eventName: "order.canceled",
          data: { id: orderId },
        },
        container: scopedContainer,
        pluginOptions: {},
      }
      const failingUpdate = jest
        .spyOn(stock, "updateDecantPlannedBottles")
        .mockRejectedValueOnce(new Error("Test-only release cleanup failure"))
      try {
        await expect(
          releaseDecantsOnOrderCanceled(event),
        ).rejects.toMatchObject({
          message: "Test-only release cleanup failure",
        })
      } finally {
        failingUpdate.mockRestore()
      }
      const beforeRetry = await stock.listDecantAllocations({
        cart_id: cartId,
      })
      expect(
        beforeRetry.every((allocation) => allocation.status === "reserved"),
      ).toBe(true)
      expect(Number((await getInventoryLevel()).reserved_quantity)).toBe(1)
      const plans = await stock.listDecantPlannedBottles({
        source_product_id: fixture.sourceProductId,
      })
      expect(plans[0].status).toBe("planned")
      await releaseDecantsOnOrderCanceled(event)
      expect(
        (await stock.listDecantAllocations({ cart_id: cartId })).every(
          (allocation) => allocation.status === "released",
        ),
      ).toBe(true)
      expect(Number((await getInventoryLevel()).reserved_quantity)).toBe(0)
    })

    it("shows not-yet-linked vials in the admin order read without mutating them", async () => {
      const container = getContainer()
      const order = await container.resolve(Modules.ORDER).createOrders({
        currency_code: "eur",
        status: "pending",
      })
      const stock: DecantStockModuleService =
        container.resolve(DECANT_STOCK_MODULE)
      const cartId = "read-only-order-cart"
      const ids = await reserveDecantSource(
        container,
        cartId,
        makeRequest(fixture, 2),
      )
      const realQuery = container.resolve(ContainerRegistrationKeys.QUERY)
      const query = {
        graph: jest.fn(async (input: { entity: string }) =>
          input.entity === "order_cart"
            ? { data: [{ cart_id: cartId }] }
            : realQuery.graph(input as never),
        ),
      }
      const scopedContainer = createScopedContainer(
        container,
        new Map<string, unknown>([[ContainerRegistrationKeys.QUERY, query]]),
      )
      const json = jest.fn()
      await getOrderDecants(
        {
          scope: scopedContainer,
          params: { id: order.id },
        } as unknown as MedusaRequest,
        { json } as unknown as MedusaResponse,
      )
      expect(
        json.mock.calls[0][0].allocations
          .map((allocation: { id: string }) => allocation.id)
          .sort(),
      ).toEqual(ids.sort())
      const after = await stock.listDecantAllocations({ cart_id: cartId })
      expect(after.every((allocation) => allocation.order_id === null)).toBe(
        true,
      )
      expect(
        after.every((allocation) => allocation.status === "reserved"),
      ).toBe(true)
    })

    it("opens one reserved bottle during preparation and cannot deduct the same vials twice", async () => {
      const container = getContainer()
      const stock: DecantStockModuleService =
        container.resolve(DECANT_STOCK_MODULE)
      const cartId = "prepared-order-cart"
      const order = await container.resolve(Modules.ORDER).createOrders({
        currency_code: "eur",
        status: "pending",
      })
      const orderId = order.id
      await reserveDecantSource(container, cartId, makeRequest(fixture, 9))
      const reserved = await stock.listDecantAllocations({
        cart_id: cartId,
        status: "reserved",
      })
      await Promise.all(
        reserved.map((allocation) =>
          stock.updateDecantAllocations({
            id: allocation.id,
            order_id: orderId,
          }),
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
      expect(
        prepared.every((allocation) => allocation.status === "prepared"),
      ).toBe(true)

      const second = await prepareDecantOrderWorkflow(container).run({
        input: { order_id: orderId },
      })
      expect(second.result).toEqual({ prepared_vials: 0, opened_bottles: 0 })
      const adjustments = await stock.listDecantAdjustments({
        order_id: orderId,
      })
      expect(adjustments).toHaveLength(1)
      expect(Number(adjustments[0].change_ml)).toBe(-90)
      const level = await getInventoryLevel()
      expect(Number(level.stocked_quantity)).toBe(0)
      expect(Number(level.reserved_quantity)).toBe(0)
    })
  },
})
