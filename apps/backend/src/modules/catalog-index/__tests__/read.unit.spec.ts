import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  transformAndValidateSalesChannelIds,
  wrapVariantsWithInventoryQuantityForSalesChannel,
} from "@medusajs/medusa/api/utils/middlewares/products/index"
import { wrapProductsWithTaxPrices } from "@medusajs/medusa/api/store/products/helpers"
import { CatalogQuerySchema } from "../../../api/store/catalog/query-schema"
import {
  prepareCatalogSnapshotWorkflow,
  publishCatalogSnapshotWorkflow,
} from "../../../workflows/publish-catalog-snapshot"
import { readCatalog } from "../read"

jest.mock("../index", () => ({ CATALOG_INDEX_MODULE: "catalogIndex" }))
jest.mock("../../perfume-taxonomy", () => ({
  PERFUME_TAXONOMY_MODULE: "perfumeTaxonomy",
}))
jest.mock("../../../workflows/publish-catalog-snapshot", () => ({
  prepareCatalogSnapshotWorkflow: jest.fn(),
  publishCatalogSnapshotWorkflow: jest.fn(),
}))
jest.mock("../../decant-stock/cart-preview", () => ({
  maxAdditionalDecantQuantity: jest.fn(),
}))
jest.mock("@medusajs/medusa/api/utils/middlewares/products/index", () => ({
  transformAndValidateSalesChannelIds: jest.fn(),
  wrapVariantsWithInventoryQuantityForSalesChannel: jest.fn(),
}))
jest.mock("@medusajs/medusa/api/store/products/helpers", () => ({
  wrapProductsWithTaxPrices: jest.fn(),
}))

const product = () => ({
  id: "product_1",
  title: "Rose",
  status: "published",
  created_at: "2026-01-01T00:00:00.000Z",
  metadata: { catalog_visible: true },
  variants: [
    {
      id: "managed",
      manage_inventory: true,
      allow_backorder: false,
      calculated_price: { calculated_amount: 12.5 },
    },
    {
      id: "backorder",
      manage_inventory: true,
      allow_backorder: true,
      calculated_price: { calculated_amount: 15 },
    },
    {
      id: "unmanaged",
      manage_inventory: false,
      allow_backorder: false,
      calculated_price: { calculated_amount: 20 },
    },
  ],
})

function fixture(facets = "false") {
  const catalog = {
    listCatalogSnapshots: jest.fn().mockResolvedValue([
      { generation: "generation_1", expires_at: new Date(Date.now() + 60_000) },
    ]),
    listAndCountCatalogEntries: jest.fn().mockResolvedValue([
      [{ product_id: "product_1", unavailable: false }],
      101,
    ]),
    listCatalogEntries: jest.fn().mockResolvedValue([]),
  }
  const query = {
    graph: jest.fn().mockImplementation(async ({ entity }) => ({
      data: entity === "product_sales_channel"
        ? [{ product_id: "product_1" }]
        : [product()],
    })),
  }
  const lock = { execute: jest.fn(async (_key, callback) => callback()) }
  const taxonomy = { listPerfumeTaxonomies: jest.fn().mockResolvedValue([]) }
  const scope = {
    resolve: jest.fn((key) => {
      if (key === "catalogIndex") return catalog
      if (key === ContainerRegistrationKeys.QUERY) return query
      if (key === Modules.LOCKING) return lock
      if (key === "perfumeTaxonomy") return taxonomy
      throw new Error(`Unexpected service: ${key}`)
    }),
  }
  const req = {
    scope,
    pricingContext: { currency_code: "eur", customer: { groups: [{ id: "group_1" }] } },
    locale: "bg",
    validatedQuery: CatalogQuerySchema.parse({
      region_id: "region_1", facets, limit: 1,
    }),
  } as unknown as Parameters<typeof readCatalog>[0]
  return { req, catalog, query, lock }
}

describe("catalog read work", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.mocked(transformAndValidateSalesChannelIds).mockReturnValue(["channel_1"])
    jest.mocked(wrapProductsWithTaxPrices).mockResolvedValue(undefined)
    jest.mocked(wrapVariantsWithInventoryQuantityForSalesChannel)
      .mockImplementation(async (_req, variants) => {
        for (const variant of variants)
          variant.inventory_quantity = variant.id === "managed" ? 0 : 4
      })
  })

  it("keeps managed and backorder quantities in the page while skipping unmanaged inventory", async () => {
    const { req, catalog, query } = fixture()
    const result = await readCatalog(req)

    expect(wrapVariantsWithInventoryQuantityForSalesChannel).toHaveBeenCalledWith(
      req,
      expect.arrayContaining([
        expect.objectContaining({ id: "managed", inventory_quantity: 0 }),
        expect.objectContaining({ id: "backorder", inventory_quantity: 4 }),
      ]),
    )
    expect(jest.mocked(wrapVariantsWithInventoryQuantityForSalesChannel).mock.calls[0][1])
      .toHaveLength(2)
    expect(result.products[0].variants).toEqual([
      { ...product().variants[0], inventory_quantity: 0 },
      { ...product().variants[1], inventory_quantity: 4 },
      product().variants[2],
    ])
    expect(result).toMatchObject({
      count: 101, offset: 0, limit: 1, unavailable_product_ids: [],
      facets: { brands: [], price_max: 5 },
    })
    expect(catalog.listCatalogEntries).not.toHaveBeenCalled()
    expect(query.graph).toHaveBeenCalledWith(expect.objectContaining({
      entity: "product_sales_channel",
      filters: { product_id: ["product_1"], sales_channel_id: "channel_1" },
    }))
    expect(wrapProductsWithTaxPrices).toHaveBeenCalledWith(req, result.products)
    expect(prepareCatalogSnapshotWorkflow).not.toHaveBeenCalled()
  })

  it("does not start an inventory query when every returned variant is unmanaged", async () => {
    const { req, query } = fixture()
    query.graph.mockImplementation(async ({ entity }) => ({
      data: entity === "product_sales_channel"
        ? [{ product_id: "product_1" }]
        : [{ ...product(), variants: [product().variants[2]] }],
    }))

    const result = await readCatalog(req)
    expect(wrapVariantsWithInventoryQuantityForSalesChannel).not.toHaveBeenCalled()
    expect(result.products[0].variants).toEqual([product().variants[2]])
  })

  it("loads every facet page while selected products are still waiting", async () => {
    const { req, query, catalog } = fixture("true")
    let releasePage!: () => void
    const pageWait = new Promise<void>((resolve) => { releasePage = resolve })
    let facetsFinished!: () => void
    const facetWait = new Promise<void>((resolve) => { facetsFinished = resolve })
    query.graph.mockImplementation(async ({ entity }) => {
      if (entity === "product_sales_channel") {
        await pageWait
        return { data: [{ product_id: "product_1" }] }
      }
      return { data: [product()] }
    })
    catalog.listCatalogEntries
      .mockResolvedValueOnce(Array.from({ length: 100 }, () => ({
        brand_value: "beta", brand_label: "Beta", price: 10,
      })))
      .mockImplementationOnce(async () => {
        facetsFinished()
        return [
          { brand_value: "alpha", brand_label: "Alpha", price: 27.2 },
          { brand_value: null, brand_label: null, price: null },
        ]
      })

    const pending = readCatalog(req)
    await facetWait
    expect(wrapProductsWithTaxPrices).not.toHaveBeenCalled()
    expect(catalog.listCatalogEntries).toHaveBeenCalledTimes(2)
    releasePage()
    const result = await pending
    expect(result.facets).toEqual({
      brands: [{ value: "alpha", label: "Alpha" }, { value: "beta", label: "Beta" }],
      price_max: 30,
    })
    const filters = catalog.listAndCountCatalogEntries.mock.calls[0][0]
    expect(catalog.listCatalogEntries).toHaveBeenNthCalledWith(2, filters, {
      select: ["brand_value", "brand_label", "price"],
      take: 100, skip: 100, order: { product_id: "ASC" },
    })
  })

  it("skips backorder stock for the projection but preserves its page quantity", async () => {
    const { req, catalog, query } = fixture()
    catalog.listCatalogSnapshots.mockResolvedValue([
      { generation: "expired", expires_at: new Date(0) },
    ])
    query.graph.mockImplementation(async ({ entity }) => ({
      data: entity === "product_sales_channel"
        ? [{ product_id: "product_1" }]
        : [{ ...product(), variants: product().variants.slice(0, 2) }],
    }))
    jest.mocked(prepareCatalogSnapshotWorkflow).mockReturnValue({
      run: jest.fn().mockResolvedValue({ result: { revision: "revision_1" } }),
    } as never)
    const publish = jest.fn().mockImplementation(async ({ input }) => ({
      result: { ...input, expires_at: new Date(Date.now() + 60_000) },
    }))
    jest.mocked(publishCatalogSnapshotWorkflow).mockReturnValue({ run: publish } as never)

    const result = await readCatalog(req)
    const inventoryCalls = jest.mocked(wrapVariantsWithInventoryQuantityForSalesChannel)
      .mock.calls
    expect(inventoryCalls.map(([, variants]) => variants.map((variant) => variant.id)))
      .toEqual([["managed"], ["managed", "backorder"]])
    expect(publish.mock.calls[0][0].input.entries[0]).toMatchObject({
      product_id: "product_1", unavailable: false, price: 12.5,
    })
    expect(result.products[0].variants?.[1]).toMatchObject({
      id: "backorder", inventory_quantity: 4,
    })
  })
})
