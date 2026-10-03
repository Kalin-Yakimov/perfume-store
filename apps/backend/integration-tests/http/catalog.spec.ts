import type { CreateProductWorkflowInputDTO } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createStockLocationsWorkflow,
  linkProductsToSalesChannelWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"
import { CATALOG_INDEX_MODULE } from "../../src/modules/catalog-index"
import CatalogIndexModuleService, {
  type CatalogEntryInput,
} from "../../src/modules/catalog-index/service"
import { PERFUME_TAXONOMY_MODULE } from "../../src/modules/perfume-taxonomy"
import PerfumeTaxonomyModuleService from "../../src/modules/perfume-taxonomy/service"
import { invalidateCatalogWorkflow } from "../../src/workflows/invalidate-catalog"
import {
  prepareCatalogSnapshotWorkflow,
  publishCatalogSnapshotWorkflow,
} from "../../src/workflows/publish-catalog-snapshot"

jest.setTimeout(120_000)

type CatalogResponse = {
  products: {
    id: string
    handle: string
    title: string
    variants: {
      id: string
      calculated_price?: { calculated_amount: number } | null
    }[]
  }[]
  count: number
  offset: number
  limit: number
  unavailable_product_ids: string[]
  facets: { brands: { value: string; label: string }[]; price_max: number }
}

type Fixture = {
  regionId: string
  channelId: string
  otherChannelId: string
  publishableKey: string
  visibleIds: string[]
  excludedIds: string[]
  pricedId: string
  femaleId: string
  freeId: string
  soldOutId: string
  roseId: string
  whiteRoseId: string
  designerId: string
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer, utils }) => {
    let fixture: Fixture

    const headers = () => ({ "x-publishable-api-key": fixture.publishableKey })
    const getCatalog = async (params: Record<string, unknown> = {}) => {
      const response = await api.get("/store/catalog", {
        params: { region_id: fixture.regionId, ...params },
        headers: headers(),
      })
      return response.data as CatalogResponse
    }
    const catalogService = (): CatalogIndexModuleService =>
      getContainer().resolve(CATALOG_INDEX_MODULE)

    beforeAll(async () => {
      const container = getContainer()
      const { result: channels } = await createSalesChannelsWorkflow(
        container,
      ).run({
        input: {
          salesChannelsData: [
            { name: "Catalog storefront" },
            { name: "Other storefront" },
          ],
        },
      })
      const channelId = channels[0].id
      const otherChannelId = channels[1].id
      const { result: keys } = await createApiKeysWorkflow(container).run({
        input: {
          api_keys: [
            { title: "Catalog HTTP test", type: "publishable", created_by: "" },
          ],
        },
      })
      await linkSalesChannelsToApiKeyWorkflow(container).run({
        input: { id: keys[0].id, add: [channelId] },
      })
      const { result: regions } = await createRegionsWorkflow(container).run({
        input: {
          regions: [
            {
              name: "Catalog Bulgaria",
              currency_code: "eur",
              countries: ["bg"],
              automatic_taxes: false,
            },
          ],
        },
      })
      const { result: locations } = await createStockLocationsWorkflow(
        container,
      ).run({
        input: { locations: [{ name: "Catalog warehouse" }] },
      })
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: { id: locations[0].id, add: [channelId] },
      })

      const taxonomy: PerfumeTaxonomyModuleService = container.resolve(
        PERFUME_TAXONOMY_MODULE,
      )
      const [designer, rose, whiteRose] =
        await taxonomy.createPerfumeTaxonomies([
          { kind: "designer", name: "Catalog House", slug: "catalog-house" },
          { kind: "note", name: "Rose", slug: "rose" },
          { kind: "note", name: "White Rose", slug: "white-rose" },
        ])
      const product = (
        handle: string,
        amount: number,
        options: {
          manageInventory?: boolean
          status?: "published" | "draft"
          channelId?: string
          metadata?: Record<string, unknown>
        } = {},
      ): CreateProductWorkflowInputDTO => ({
        title: handle,
        handle,
        status: options.status || "published",
        sales_channels: [{ id: options.channelId || channelId }],
        metadata: {
          listing_type: "full_perfume",
          catalog_visible: true,
          brand: "Batch House",
          gender: "unisex",
          ...options.metadata,
        },
        options: [{ title: "Volume", values: ["50 ml"] }],
        variants: [
          {
            title: "50 ml",
            sku: handle.toUpperCase(),
            options: { Volume: "50 ml" },
            manage_inventory: options.manageInventory || false,
            allow_backorder: false,
            prices: [{ amount, currency_code: "eur" }],
          },
        ],
      })
      const referenceProfile = (noteId: string) => ({
        designer_id: designer.id,
        top_note_ids: [noteId],
        heart_note_ids: [],
        base_note_ids: [],
      })
      const { result: products } = await createProductsWorkflow(container).run({
        input: {
          products: [
            ...Array.from({ length: 101 }, (_, index) =>
              product(
                `catalog-batch-${String(index).padStart(3, "0")}`,
                20 + index / 100,
              ),
            ),
            product("catalog-priced", 17.99, {
              manageInventory: true,
              metadata: {
                brand: designer.name,
                gender: "male",
                perfume_profile: referenceProfile(rose.id),
              },
            }),
            product("catalog-female", 2.99, {
              metadata: {
                brand: designer.name,
                gender: "female",
                perfume_profile: referenceProfile(whiteRose.id),
              },
            }),
            product("catalog-free", 0, {
              metadata: {
                brand: "Second House",
                perfume_notes: ["White Rose"],
              },
            }),
            product("catalog-sold-out", 0, {
              manageInventory: true,
              metadata: {
                brand: designer.name,
                gender: "male",
                perfume_profile: referenceProfile(rose.id),
              },
            }),
            product("catalog-hidden", 800, {
              metadata: { catalog_visible: false, brand: "Hidden House" },
            }),
            product("catalog-draft", 900, {
              status: "draft",
              metadata: { brand: "Draft House" },
            }),
            product("catalog-other-channel", 950, {
              channelId: otherChannelId,
              metadata: { brand: "Other House" },
            }),
            product("catalog-not-opted-in", 990, {
              metadata: { catalog_visible: null, brand: "Not Opted In" },
            }),
          ],
        },
      })
      const byHandle = new Map(products.map((entry) => [entry.handle, entry]))
      const priced = byHandle.get("catalog-priced")!
      const soldOut = byHandle.get("catalog-sold-out")!
      const { data: managedVariants } = await container
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "product_variant",
          filters: { id: [priced.variants[0].id, soldOut.variants[0].id] },
          fields: ["id", "inventory_items.inventory_item_id"],
        })
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: managedVariants.map((variant) => {
            const inventoryItemId =
              variant.inventory_items?.[0]?.inventory_item_id
            if (!inventoryItemId)
              throw new Error("Catalog fixture is missing managed inventory")
            return {
              inventory_item_id: inventoryItemId,
              location_id: locations[0].id,
              stocked_quantity: variant.id === priced.variants[0].id ? 2 : 0,
            }
          }),
        },
      })
      const excludedHandles = new Set([
        "catalog-hidden",
        "catalog-draft",
        "catalog-other-channel",
        "catalog-not-opted-in",
      ])
      fixture = {
        regionId: regions[0].id,
        channelId,
        otherChannelId,
        publishableKey: keys[0].token,
        visibleIds: products
          .filter((entry) => !excludedHandles.has(entry.handle))
          .map((entry) => entry.id),
        excludedIds: products
          .filter((entry) => excludedHandles.has(entry.handle))
          .map((entry) => entry.id),
        pricedId: priced.id,
        femaleId: byHandle.get("catalog-female")!.id,
        freeId: byHandle.get("catalog-free")!.id,
        soldOutId: soldOut.id,
        roseId: rose.id,
        whiteRoseId: whiteRose.id,
        designerId: designer.id,
      }
      // The runner snapshots these fixtures once and restores them per test.
      await utils.waitWorkflowExecutions()
    })

    afterEach(() => jest.restoreAllMocks())

    it("paginates the entire visible sales-channel catalog beyond 100 products", async () => {
      const first = await getCatalog({ limit: 100 })
      const second = await getCatalog({ limit: 100, offset: 100 })
      expect(first).toMatchObject({ count: 105, offset: 0, limit: 100 })
      expect(second).toMatchObject({ count: 105, offset: 100, limit: 100 })
      expect(first.products).toHaveLength(100)
      expect(second.products).toHaveLength(5)
      const ids = [...first.products, ...second.products].map(
        (entry) => entry.id,
      )
      expect(new Set(ids).size).toBe(105)
      expect([...ids].sort()).toEqual([...fixture.visibleIds].sort())
      for (const id of fixture.excludedIds) expect(ids).not.toContain(id)
      expect((await getCatalog({ offset: 105 })).products).toEqual([])
    })

    it.each(["price_asc", "price_desc", "created_at"])(
      "keeps available products first globally before paginating %s",
      async (sort) => {
        const first = await getCatalog({ sort, limit: 1 })
        const boundary = await getCatalog({ sort, offset: 103, limit: 2 })
        expect(first.unavailable_product_ids).toEqual([])
        expect(boundary.products[1].id).toBe(fixture.soldOutId)
        expect(boundary.products[0].id).not.toBe(fixture.soldOutId)
        expect(boundary.unavailable_product_ids).toEqual([fixture.soldOutId])
      },
    )

    it("keeps decimal money values and inclusive price boundaries, including zero", async () => {
      const decimal = await getCatalog({ min_price: 17.99, max_price: 17.99 })
      expect(decimal.count).toBe(1)
      expect(decimal.products[0].id).toBe(fixture.pricedId)
      expect(
        decimal.products[0].variants[0].calculated_price?.calculated_amount,
      ).toBe(17.99)
      const inexpensive = await getCatalog({ min_price: 2.99, max_price: 2.99 })
      expect(inexpensive.products.map((entry) => entry.id)).toEqual([
        fixture.femaleId,
      ])
      expect(
        inexpensive.products[0].variants[0].calculated_price?.calculated_amount,
      ).toBe(2.99)
      const zero = await getCatalog({
        min_price: 0,
        max_price: 0,
        sort: "price_asc",
      })
      expect(zero.count).toBe(2)
      expect(zero.products.map((entry) => entry.id)).toEqual([
        fixture.freeId,
        fixture.soldOutId,
      ])
      expect(
        zero.products[0].variants[0].calculated_price?.calculated_amount,
      ).toBe(0)
    })

    it("matches gender and note tokens exactly for both references and legacy labels", async () => {
      const male = await getCatalog({ gender: "male" })
      expect(male.products.map((entry) => entry.id).sort()).toEqual(
        [fixture.pricedId, fixture.soldOutId].sort(),
      )
      expect(male.products.map((entry) => entry.id)).not.toContain(
        fixture.femaleId,
      )
      const rose = await getCatalog({ note: fixture.roseId })
      expect(rose.products.map((entry) => entry.id).sort()).toEqual(
        [fixture.pricedId, fixture.soldOutId].sort(),
      )
      const roseLabel = await getCatalog({ note: "Rose" })
      expect(roseLabel.products.map((entry) => entry.id).sort()).toEqual(
        [fixture.pricedId, fixture.soldOutId].sort(),
      )
      const whiteRose = await getCatalog({ note: fixture.whiteRoseId })
      expect(whiteRose.products.map((entry) => entry.id).sort()).toEqual(
        [fixture.femaleId, fixture.freeId].sort(),
      )
      expect((await getCatalog({ gender: "ale" })).count).toBe(0)
    })

    it("returns global facets without letting active filters or excluded products truncate them", async () => {
      const data = await getCatalog({
        gender: "male",
        note: fixture.roseId,
        min_price: 17.99,
        max_price: 17.99,
        limit: 1,
        facets: "true",
      })
      expect(data.count).toBe(1)
      expect(data.facets.brands).toEqual(
        expect.arrayContaining([
          { value: "Batch House", label: "Batch House" },
          { value: fixture.designerId, label: "Catalog House" },
          { value: "Second House", label: "Second House" },
        ]),
      )
      expect(data.facets.brands).toHaveLength(3)
      expect(data.facets.price_max).toBe(25)
      const searchFacets = await getCatalog({
        q: "catalog-female",
        facets: "true",
      })
      expect(searchFacets.count).toBe(1)
      expect(searchFacets.facets.brands).toEqual([
        { value: fixture.designerId, label: "Catalog House" },
      ])
      expect(searchFacets.facets.price_max).toBe(5)
    })

    it("validates pagination, prices, sort, region, and publishable-key channel access", async () => {
      for (const params of [
        { limit: 101 },
        { limit: 0 },
        { offset: -1 },
        { offset: 1.5 },
        { sort: "unknown" },
        { min_price: 20, max_price: 1 },
        { min_price: -1 },
        { unexpected: "field" },
        { sales_channel_id: fixture.otherChannelId },
      ]) {
        const response = await api.get("/store/catalog", {
          params: { region_id: fixture.regionId, ...params },
          headers: headers(),
          validateStatus: () => true,
        })
        expect(response.status).toBe(400)
      }
      const missingRegion = await api.get("/store/catalog", {
        headers: headers(),
        validateStatus: () => true,
      })
      expect(missingRegion.status).toBe(400)
      const missingKey = await api.get("/store/catalog", {
        params: { region_id: fixture.regionId },
        validateStatus: () => true,
      })
      expect(missingKey.status).toBe(400)
    })

    it("reuses a warm snapshot while keeping HTTP responses private to their request", async () => {
      const first = await getCatalog({ limit: 2 })
      const [before] = await catalogService().listCatalogSnapshots(
        {},
        { take: 1 },
      )
      const publish = jest.spyOn(catalogService(), "publishSnapshot")
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const graph = jest.spyOn(query, "graph")
      const response = await api.get("/store/catalog", {
        params: { region_id: fixture.regionId, limit: 2 },
        headers: headers(),
      })
      const [after] = await catalogService().listCatalogSnapshots(
        {},
        { take: 1 },
      )
      expect(response.data).toEqual(first)
      expect(response.headers["cache-control"]).toBe("no-store")
      expect(after.generation).toBe(before.generation)
      expect(publish).not.toHaveBeenCalled()
      const productQueries = graph.mock.calls
        .map(([input]) => input)
        .filter((input) => input.entity === "product")
      expect(productQueries.length).toBeGreaterThan(0)
      for (const input of productQueries) {
        const ids = input.filters?.id
        if (!Array.isArray(ids))
          throw new Error("Warm catalog hydration must select product IDs")
        expect(ids.length).toBeLessThanOrEqual(2)
      }
      const [, count] = await catalogService().listAndCountCatalogEntries({
        context_key: after.context_key,
        generation: after.generation,
      })
      expect(count).toBe(105)
    })

    it("publishes one complete generation for simultaneous cold HTTP requests", async () => {
      await invalidateCatalogWorkflow(getContainer()).run({ input: {} })
      const publish = jest.spyOn(catalogService(), "publishSnapshot")
      const responses = await Promise.all(
        Array.from({ length: 4 }, () => getCatalog({ limit: 3 })),
      )
      expect(responses.every((response) => response.count === 105)).toBe(true)
      for (const response of responses) expect(response).toEqual(responses[0])
      expect(publish).toHaveBeenCalledTimes(1)
      const snapshots = await catalogService().listCatalogSnapshots({})
      expect(snapshots).toHaveLength(1)
      expect(new Date(snapshots[0].expires_at).getTime()).toBeGreaterThan(
        Date.now(),
      )
    })

    it("invalidates a warm snapshot through the real product subscriber and rebuilds its visible count", async () => {
      const initial = await getCatalog({ id: fixture.freeId })
      expect(initial.products.map((entry) => entry.id)).toEqual([
        fixture.freeId,
      ])
      const [before] = await catalogService().listCatalogSnapshots(
        {},
        { take: 1 },
      )
      expect(new Date(before.expires_at).getTime()).toBeGreaterThan(Date.now())
      const products = getContainer().resolve(Modules.PRODUCT)
      const saved = await products.retrieveProduct(fixture.freeId)
      await products.updateProducts(fixture.freeId, {
        metadata: { ...saved.metadata, catalog_visible: false },
      })
      await utils.waitWorkflowExecutions()
      let [invalidated] = await catalogService().listCatalogSnapshots({
        context_key: before.context_key,
      })
      // The local event bus dispatches subscribers asynchronously. Wait for the
      // real subscriber rather than triggering invalidation directly in this test.
      for (
        let attempt = 0;
        attempt < 100 && invalidated.revision === before.revision;
        attempt++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 25))
        await utils.waitWorkflowExecutions()
        invalidated = (
          await catalogService().listCatalogSnapshots({
            context_key: before.context_key,
          })
        )[0]
      }
      expect(invalidated.revision).not.toBe(before.revision)
      expect(invalidated.generation).toBe(before.generation)
      expect(new Date(invalidated.expires_at).getTime()).toBeLessThanOrEqual(
        Date.now(),
      )
      const refreshed = await getCatalog({ limit: 100 })
      expect(refreshed.count).toBe(104)
      expect(refreshed.products.map((entry) => entry.id)).not.toContain(
        fixture.freeId,
      )
      expect((await getCatalog({ id: fixture.freeId })).count).toBe(0)
      const [after] = await catalogService().listCatalogSnapshots({
        context_key: before.context_key,
      })
      expect(after.generation).not.toBe(before.generation)
      expect(new Date(after.expires_at).getTime()).toBeGreaterThan(Date.now())
    })

    it("rolls back every chunk and keeps the previous pointer when publication fails", async () => {
      await getCatalog({ limit: 1 })
      const container = getContainer()
      const catalog = catalogService()
      const [before] = await catalog.listCatalogSnapshots({}, { take: 1 })
      const { result: prepared } = await prepareCatalogSnapshotWorkflow(
        container,
      ).run({
        input: before.context_key,
      })
      const generation = "integration-failed-publication"
      const current = await catalog.listCatalogEntries(
        {
          context_key: before.context_key,
          generation: before.generation,
        },
        { take: 200 },
      )
      expect(current).toHaveLength(105)
      const entries: CatalogEntryInput[] = current.map(
        ({ id, created_at, updated_at, deleted_at, raw_price, ...entry }) => ({
          ...entry,
          generation,
        }),
      )
      const originalCreate = catalog.createCatalogEntries.bind(catalog)
      const create = jest
        .spyOn(catalog, "createCatalogEntries")
        .mockImplementationOnce(originalCreate)
        .mockRejectedValueOnce(
          new Error("Test-only second catalog chunk failure"),
        )
      try {
        await expect(
          publishCatalogSnapshotWorkflow(container).run({
            input: {
              context_key: before.context_key,
              generation,
              revision: prepared.revision,
              entries,
            },
          }),
        ).rejects.toMatchObject({
          message: "Test-only second catalog chunk failure",
        })
        expect(create).toHaveBeenCalledTimes(2)
      } finally {
        create.mockRestore()
      }
      const [after] = await catalog.listCatalogSnapshots({
        context_key: before.context_key,
      })
      expect(after).toMatchObject({
        id: before.id,
        generation: before.generation,
        revision: prepared.revision,
      })
      const [, failedCount] = await catalog.listAndCountCatalogEntries({
        context_key: before.context_key,
        generation,
      })
      expect(failedCount).toBe(0)
      const [, previousCount] = await catalog.listAndCountCatalogEntries({
        context_key: before.context_key,
        generation: before.generation,
      })
      expect(previousCount).toBe(105)
    })

    it("rechecks channel membership before exposing products from a warm snapshot", async () => {
      const before = await getCatalog({ id: fixture.pricedId })
      expect(before.count).toBe(1)
      expect(before.products.map((entry) => entry.id)).toEqual([
        fixture.pricedId,
      ])
      const [warm] = await catalogService().listCatalogSnapshots(
        {},
        { take: 1 },
      )
      await linkProductsToSalesChannelWorkflow(getContainer()).run({
        input: { id: fixture.channelId, remove: [fixture.pricedId] },
      })
      const publish = jest.spyOn(catalogService(), "publishSnapshot")
      const after = await getCatalog({ id: fixture.pricedId })
      // The derived count may stay stale until invalidation/expiry, but the
      // request must immediately stop exposing a product removed from the channel.
      expect(after.count).toBe(before.count)
      expect(after.products).toEqual([])
      expect(after.unavailable_product_ids).toEqual([])
      expect(publish).not.toHaveBeenCalled()
      const [stillWarm] = await catalogService().listCatalogSnapshots({
        context_key: warm.context_key,
      })
      expect(stillWarm.generation).toBe(warm.generation)
      expect(new Date(stillWarm.expires_at).getTime()).toBeGreaterThan(
        Date.now(),
      )
    })

    it("recreates one unique pointer when cleanup deletes it before the locked preparation read", async () => {
      const container = getContainer()
      const catalog = catalogService()
      const contextKey = "integration-preparation-cleanup-race"
      const { result: before } = await prepareCatalogSnapshotWorkflow(
        container,
      ).run({
        input: contextKey,
      })
      const originalList = catalog.listCatalogSnapshots.bind(catalog)
      let deleted = false
      let lockedReads = 0
      const list = jest
        .spyOn(catalog, "listCatalogSnapshots")
        .mockImplementation(async (filters, config, context) => {
          if (config?.options?.lockMode) {
            lockedReads++
            if (!deleted) {
              deleted = true
              // Simulate cleanup committing after the unlocked existence read,
              // before this transaction acquires its pointer row lock.
              await catalog.deleteCatalogSnapshots(before.id)
            }
          }
          return originalList(filters, config, context)
        })
      try {
        const { result: prepared } = await prepareCatalogSnapshotWorkflow(
          container,
        ).run({
          input: contextKey,
        })
        expect(deleted).toBe(true)
        expect(lockedReads).toBe(2)
        expect(prepared.id).not.toBe(before.id)
        expect(prepared.context_key).toBe(contextKey)
        const saved = await catalog.listCatalogSnapshots({
          context_key: contextKey,
        })
        expect(saved).toHaveLength(1)
        expect(saved[0].id).toBe(prepared.id)
      } finally {
        list.mockRestore()
      }
    })

    it("does not mark a generation fresh if invalidation raced its preparation", async () => {
      const container = getContainer()
      const contextKey = "integration-revision-race"
      const { result: prepared } = await prepareCatalogSnapshotWorkflow(
        container,
      ).run({ input: contextKey })
      await invalidateCatalogWorkflow(container).run({ input: {} })
      const { result: superseded } = await publishCatalogSnapshotWorkflow(
        container,
      ).run({
        input: {
          context_key: contextKey,
          generation: "superseded",
          revision: prepared.revision,
          entries: [],
        },
      })
      expect(superseded.revision).not.toBe(prepared.revision)
      expect(new Date(superseded.expires_at).getTime()).toBeLessThanOrEqual(
        Date.now(),
      )
      const { result: freshPreparation } = await prepareCatalogSnapshotWorkflow(
        container,
      ).run({ input: contextKey })
      const { result: fresh } = await publishCatalogSnapshotWorkflow(
        container,
      ).run({
        input: {
          context_key: contextKey,
          generation: "fresh",
          revision: freshPreparation.revision,
          entries: [],
        },
      })
      expect(fresh.generation).toBe("fresh")
      expect(fresh.revision).toBe(freshPreparation.revision)
      expect(new Date(fresh.expires_at).getTime()).toBeGreaterThan(Date.now())
      const saved = await catalogService().listCatalogSnapshots({
        context_key: contextKey,
      })
      expect(saved).toHaveLength(1)
      expect(saved[0].generation).toBe("fresh")
    })
  },
})
