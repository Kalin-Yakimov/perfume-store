import { catalogToken } from "../filters"
import { projectCatalogProduct, type CatalogProduct, type CatalogTaxonomy } from "../projection"

const product = (overrides: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id: "product_1",
  title: "Old designer Aroma",
  handle: "aroma",
  created_at: "2026-01-01T00:00:00.000Z",
  metadata: {},
  variants: [],
  ...overrides,
} as CatalogProduct)

const project = (item: CatalogProduct, taxonomies: CatalogTaxonomy[] = [], unavailable = false) =>
  projectCatalogProduct(item, taxonomies, "context_1", "generation_1", unavailable)

describe("catalog product projection", () => {
  it("uses stable designer and note references after labels are renamed", () => {
    const entry = project(product({
      metadata: {
        brand: "Old designer",
        perfume_notes: ["Old note"],
        perfume_profile: {
          designer_id: "designer_1",
          top_note_ids: ["note_top"],
          heart_note_ids: ["note_heart"],
          base_note_ids: ["note_base"],
        },
      },
    }), [
      { id: "designer_1", kind: "designer", name: "New designer" },
      { id: "designer_other", kind: "designer", name: "Old designer" },
      { id: "note_top", kind: "note", name: "New top note" },
      { id: "note_heart", kind: "note", name: "New heart note" },
      { id: "note_base", kind: "note", name: "New base note" },
      { id: "note_other", kind: "note", name: "Old note" },
    ])

    expect(entry).toMatchObject({
      designer_id: "designer_1",
      brand_value: "designer_1",
      brand_label: "New designer",
      legacy_note_text: "",
      traits: {
        brands: { [catalogToken("designer_1")]: true, [catalogToken("New designer")]: true },
        notes: {
          [catalogToken("note_top")]: true, [catalogToken("New top note")]: true,
          [catalogToken("note_heart")]: true, [catalogToken("New heart note")]: true,
          [catalogToken("note_base")]: true, [catalogToken("New base note")]: true,
        },
      },
    })
    expect(entry.traits.brands).not.toHaveProperty(catalogToken("Old designer"))
    expect(entry.traits.brands).not.toHaveProperty(catalogToken("designer_other"))
    expect(entry.traits.notes).not.toHaveProperty(catalogToken("Old note"))
    expect(entry.traits.notes).not.toHaveProperty(catalogToken("note_other"))
  })

  it("does not reintroduce legacy or demo notes when explicit note IDs were cleared", () => {
    const entry = project(product({
      handle: "demo-perfume-01",
      metadata: { perfume_notes: ["Роза"], perfume_profile: { top_note_ids: [] } },
      tags: [{ id: "tag_1", value: "Роза", created_at: "2026-01-01", updated_at: "2026-01-01" }],
    }), [{ id: "note_rose", kind: "note", name: "Роза" }])

    expect(entry.traits.notes).toEqual({})
    expect(entry.legacy_note_text).toBe("")
  })

  it("maps legacy note labels to taxonomy IDs only when stored references are absent", () => {
    const entry = project(product({ metadata: { perfume_notes: " Роза / Мускус " } }), [
      { id: "note_rose", kind: "note", name: "Роза" },
      { id: "note_musk", kind: "note", name: "Мускус" },
    ])

    expect(entry.traits.notes).toEqual({
      [catalogToken("роза")]: true, [catalogToken("note_rose")]: true,
      [catalogToken("мускус")]: true, [catalogToken("note_musk")]: true,
    })
  })

  it("keeps female and male genders as distinct exact tokens", () => {
    const entry = project(product({ metadata: { gender: " Female " } }))

    expect(entry.traits.genders).toEqual({ [catalogToken("female")]: true })
    expect(entry.traits.genders).not.toHaveProperty(catalogToken("male"))
  })

  it.each([
    [[25.5, 12.75], 12.75],
    [[25.5, 0], 0],
    [[undefined, Number.NaN, Number.POSITIVE_INFINITY], null],
  ])("uses the cheapest finite calculated variant amount in %j", (amounts, expected) => {
    const variants = amounts.map((amount, index) => ({
      id: `variant_${index}`,
      manage_inventory: false,
      calculated_price: { calculated_amount: amount },
    })) as unknown as CatalogProduct["variants"]

    expect(project(product({ variants })).price).toBe(expected)
  })

  it("carries the snapshot context and backend availability into the projection", () => {
    expect(project(product(), [], true)).toMatchObject({
      context_key: "context_1",
      generation: "generation_1",
      product_id: "product_1",
      product_created_at: new Date("2026-01-01T00:00:00.000Z"),
      unavailable: true,
      listing_type: "full_perfume",
    })
  })
})
