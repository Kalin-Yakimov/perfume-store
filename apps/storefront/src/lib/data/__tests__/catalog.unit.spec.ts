import { sdk } from "@lib/config"
import type { HttpTypes } from "@medusajs/types"
import { listCatalogProducts } from "../catalog"
import { getAuthHeaders } from "../cookies"
import { listPerfumeTaxonomies } from "../perfume-taxonomies"
import { getRegion } from "../regions"

jest.mock("@lib/config", () => ({ sdk: { client: { fetch: jest.fn() } } }))
jest.mock("../cookies", () => ({ getAuthHeaders: jest.fn() }))
jest.mock("../regions", () => ({ getRegion: jest.fn() }))
jest.mock("../perfume-taxonomies", () => ({ listPerfumeTaxonomies: jest.fn() }))

const products = [
  { id: "product_z", title: "Z aroma", handle: "z-aroma", metadata: { catalog_visible: true }, variants: [] },
  { id: "product_a", title: "A aroma", handle: "a-aroma", metadata: { catalog_visible: true }, variants: [] },
] as unknown as HttpTypes.StoreProduct[]

const response = {
  products,
  count: 231,
  unavailable_product_ids: ["product_a"],
  facets: { brands: [{ value: "designer_1", label: "Designer" }], price_max: 25.5 },
}

describe("catalog requests", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.mocked(getRegion).mockResolvedValue({ id: "region_1" } as HttpTypes.StoreRegion)
    jest.mocked(getAuthHeaders).mockResolvedValue({ authorization: "Bearer unit-test" })
    jest.mocked(listPerfumeTaxonomies).mockResolvedValue([])
    jest.mocked(sdk.client.fetch).mockResolvedValue(response)
  })

  it("requests only the selected page with all filter IDs and preserves backend order and data", async () => {
    const result = await listCatalogProducts({
      countryCode: "bg",
      page: 3,
      limit: 6,
      sortBy: "price_asc",
      query: "Aroma",
      listingType: "decant",
      filters: {
        genders: ["male", "unisex"],
        seasons: ["winter"],
        brands: ["designer_1"],
        notes: ["note_1", "note_2"],
        minPrice: 0,
        maxPrice: 25.5,
      },
      optionValueIds: ["option_1"],
      collectionIds: ["collection_1", "collection_2"],
      categoryIds: ["category_1"],
      productIds: ["product_z", "product_a"],
      facets: true,
    })

    expect(getRegion).toHaveBeenCalledWith("bg")
    expect(getAuthHeaders).toHaveBeenCalledTimes(1)
    expect(sdk.client.fetch).toHaveBeenCalledTimes(1)
    expect(sdk.client.fetch).toHaveBeenCalledWith("/store/catalog", {
      query: {
        region_id: "region_1", limit: 6, offset: 12, sort: "price_asc", facets: "true",
        listing_type: "decant", q: "Aroma", gender: ["male", "unisex"], season: ["winter"],
        brand: ["designer_1"], note: ["note_1", "note_2"], min_price: 0, max_price: 25.5,
        option_value_id: ["option_1"], collection_id: ["collection_1", "collection_2"],
        category_id: ["category_1"], id: ["product_z", "product_a"],
      },
      headers: { authorization: "Bearer unit-test" },
      cache: "no-store",
    })
    expect(result).toEqual(response)
    expect(result.products.map((product) => product.id)).toEqual(["product_z", "product_a"])
    expect(listPerfumeTaxonomies).not.toHaveBeenCalled()
  })

  it("resolves renamed taxonomy labels without changing backend ordering, totals, or availability", async () => {
    const profiled = {
      ...products[0],
      title: "Old designer Aroma",
      metadata: {
        catalog_visible: true,
        brand: "Old designer",
        perfume_profile: { designer_id: "designer_1", top_note_ids: ["note_1"] },
      },
    }
    jest.mocked(sdk.client.fetch).mockResolvedValue({ ...response, products: [profiled, products[1]] })
    jest.mocked(listPerfumeTaxonomies).mockResolvedValue([
      { id: "designer_1", kind: "designer", name: "New designer" },
      { id: "note_1", kind: "note", name: "New note" },
    ] as Awaited<ReturnType<typeof listPerfumeTaxonomies>>)

    const result = await listCatalogProducts({ countryCode: "bg" })

    expect(listPerfumeTaxonomies).toHaveBeenCalledTimes(1)
    expect(result.products.map((product) => product.id)).toEqual(["product_z", "product_a"])
    expect(result.products[0]).toMatchObject({
      title: "New designer Aroma",
      metadata: { brand: "New designer", perfume_notes: ["New note"] },
    })
    expect(result.count).toBe(response.count)
    expect(result.unavailable_product_ids).toEqual(response.unavailable_product_ids)
    expect(result.facets).toEqual(response.facets)
    expect(profiled.title).toBe("Old designer Aroma")
    expect(profiled.metadata.brand).toBe("Old designer")
  })

  it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])("uses the first page for an invalid page number %s", async (page) => {
    await listCatalogProducts({ countryCode: "bg", page })

    expect(sdk.client.fetch).toHaveBeenCalledWith("/store/catalog", expect.objectContaining({
      query: { region_id: "region_1", limit: 40, offset: 0, sort: "created_at", facets: "false" },
      cache: "no-store",
    }))
  })

  it("returns an empty catalog without calling the backend when the region is missing", async () => {
    jest.mocked(getRegion).mockResolvedValue(null)

    await expect(listCatalogProducts({ countryCode: "unknown" })).resolves.toEqual({
      products: [], count: 0, unavailable_product_ids: [], facets: { brands: [], price_max: 100 },
    })
    expect(sdk.client.fetch).not.toHaveBeenCalled()
    expect(getAuthHeaders).not.toHaveBeenCalled()
  })

  it("returns an empty catalog immediately for an explicitly empty product-ID selection", async () => {
    await expect(listCatalogProducts({ countryCode: "bg", productIds: [] })).resolves.toEqual({
      products: [], count: 0, unavailable_product_ids: [], facets: { brands: [], price_max: 100 },
    })

    expect(getRegion).not.toHaveBeenCalled()
    expect(getAuthHeaders).not.toHaveBeenCalled()
    expect(sdk.client.fetch).not.toHaveBeenCalled()
    expect(listPerfumeTaxonomies).not.toHaveBeenCalled()
  })
})
