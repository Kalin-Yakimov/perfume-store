import { CatalogQuerySchema } from "../../../api/store/catalog/query-schema"

describe("catalog query validation", () => {
  it("coerces bounded pagination and prices while preserving filter IDs", () => {
    expect(CatalogQuerySchema.parse({
      region_id: " region_1 ", limit: "100", offset: "1000000", sort: "price_asc",
      min_price: "0", max_price: "25.5", facets: "true", gender: " male ",
      note: [" note_1 ", "note_2"], category_id: "category_1", option_value_id: "option_1",
    })).toEqual({
      region_id: "region_1", limit: 100, offset: 1_000_000, sort: "price_asc",
      min_price: 0, max_price: 25.5, facets: "true", gender: ["male"],
      note: ["note_1", "note_2"], category_id: ["category_1"], option_value_id: ["option_1"],
    })
  })

  it("applies a bounded default page and sort", () => {
    expect(CatalogQuerySchema.parse({ region_id: "region_1" })).toEqual({
      region_id: "region_1", limit: 40, offset: 0, sort: "created_at", facets: "false",
    })
  })

  it.each([
    { limit: 0 }, { limit: 101 }, { limit: 1.5 },
    { offset: -1 }, { offset: 1_000_001 }, { offset: 0.5 },
    { min_price: -0.01 }, { max_price: -1 },
    { min_price: "Infinity" }, { max_price: "NaN" },
    { min_price: 20, max_price: 10 },
    { sort: "title" }, { facets: "yes" }, { listing_type: "unknown" },
    { q: "q".repeat(201) },
    { gender: [""] }, { note: "n".repeat(129) },
    { id: Array.from({ length: 51 }, (_, i) => `product_${i}`) },
    { fields: "*variants" }, { unknown_filter: "anything" },
  ])("rejects an invalid or unknown query: %j", (query) => {
    expect(CatalogQuerySchema.safeParse({ region_id: "region_1", ...query }).success).toBe(false)
  })

  it("requires a nonempty region context", () => {
    expect(CatalogQuerySchema.safeParse({}).success).toBe(false)
    expect(CatalogQuerySchema.safeParse({ region_id: " " }).success).toBe(false)
  })
})
