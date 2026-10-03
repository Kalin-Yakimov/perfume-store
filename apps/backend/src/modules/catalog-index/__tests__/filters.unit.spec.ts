import { CatalogQuerySchema } from "../../../api/store/catalog/query-schema"
import { catalogFilters, catalogOrder, catalogToken } from "../filters"

describe("catalog filters", () => {
  it("uses exact normalized tokens for genders rather than substring matches", () => {
    const input = CatalogQuerySchema.parse({ region_id: "region_1", gender: " Male " })

    expect(catalogToken(" Male ")).toBe(catalogToken("male"))
    expect(catalogToken("male")).not.toBe(catalogToken("female"))
    expect(catalogToken("male")).toMatch(/^[a-f0-9]{64}$/)
    expect(catalogFilters("context_1", "generation_1", input)).toEqual({
      context_key: "context_1",
      generation: "generation_1",
      $and: [{ $or: [{ traits: { genders: { [catalogToken("male")]: true } } }] }],
    })
  })

  it("combines all selected filters in the database and retains a zero minimum price", () => {
    const input = CatalogQuerySchema.parse({
      region_id: "region_1",
      listing_type: "decant",
      id: ["product_1", "product_2"],
      collection_id: ["collection_1"],
      category_id: ["category.1"],
      option_value_id: ["option_1"],
      gender: ["male", "unisex"],
      season: ["winter"],
      brand: ["designer_1"],
      note: ["note_1"],
      min_price: 0,
      max_price: 25.5,
    })

    expect(catalogFilters("context_1", "generation_1", input)).toEqual({
      context_key: "context_1",
      generation: "generation_1",
      listing_type: "decant",
      product_id: ["product_1", "product_2"],
      collection_id: ["collection_1"],
      price: { $gte: 0, $lte: 25.5 },
      $and: [
        { $or: [{ traits: { options: { [catalogToken("option_1")]: true } } }] },
        { $or: [{ traits: { categories: { [catalogToken("category.1")]: true } } }] },
        { $or: [
          { traits: { genders: { [catalogToken("male")]: true } } },
          { traits: { genders: { [catalogToken("unisex")]: true } } },
        ] },
        { $or: [{ traits: { seasons: { [catalogToken("winter")]: true } } }] },
        { $or: [{ $or: [
          { traits: { brands: { [catalogToken("designer_1")]: true } } },
          { designer_id: null, brand_text: { $ilike: "%designer\\_1%" } },
        ] }] },
        { $or: [{ traits: { notes: { [catalogToken("note_1")]: true } } }] },
      ],
    })
  })

  it("requires every search word and escapes SQL wildcard characters", () => {
    const input = CatalogQuerySchema.parse({ region_id: "region_1", q: " ROSE   50%_ " })

    expect(catalogFilters("context_1", "generation_1", input).$and).toEqual([
      { search_text: { $ilike: "%rose%" } },
      { search_text: { $ilike: "%50\\%\\_%" } },
    ])
  })

  it("keeps search, listing, and option constraints when loading unselected facets", () => {
    const input = CatalogQuerySchema.parse({
      region_id: "region_1", q: "Rose", listing_type: "decant",
      option_value_id: "option_1", id: "product_1", collection_id: "collection_1",
      category_id: "category_1", gender: "male", season: "winter",
      brand: "designer_1", note: "note_1", min_price: 10, max_price: 20,
    })

    expect(catalogFilters("context_1", "generation_1", input, true)).toEqual({
      context_key: "context_1",
      generation: "generation_1",
      listing_type: "decant",
      $and: [
        { search_text: { $ilike: "%rose%" } },
        { $or: [{ traits: { options: { [catalogToken("option_1")]: true } } }] },
      ],
    })
  })
})

describe("catalog ordering", () => {
  it.each([
    ["created_at", "product_created_at", "DESC"],
    ["price_asc", "price", "ASC NULLS LAST"],
    ["price_desc", "price", "DESC NULLS LAST"],
  ] as const)("puts unavailable products last and stabilizes %s ties by product ID", (sort, field, direction) => {
    const order = catalogOrder(sort)

    expect(Object.entries(order)).toEqual([
      ["unavailable", "ASC"],
      [field, direction],
      ["product_id", "ASC"],
    ])
  })
})
