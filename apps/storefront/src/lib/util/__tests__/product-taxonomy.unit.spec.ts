import type { HttpTypes } from "@medusajs/types"
import {
  resolveProductTaxonomy,
  catalogBrandOptions,
} from "../product-taxonomy"
import { filterPerfumeProducts, PerfumeFilters } from "../perfume-filters"
import type { PerfumeTaxonomyItem } from "@lib/data/perfume-taxonomies"

const items: PerfumeTaxonomyItem[] = [
  {
    id: "designer_1",
    kind: "designer",
    name: "New brand",
    slug: "brand",
    original_name: null,
    image_url: null,
  },
  {
    id: "note_1",
    kind: "note",
    name: "Нова нотка",
    slug: "note",
    original_name: null,
    image_url: null,
  },
]
const product = {
  id: "product_1",
  title: "Old brand Aroma",
  handle: "aroma",
  variants: [],
  metadata: {
    catalog_visible: true,
    brand: "Old brand",
    perfume_name: "Aroma",
    perfume_notes: ["Old note"],
    perfume_profile: {
      designer_id: "designer_1",
      top_note_ids: ["note_1"],
      heart_note_ids: [],
      base_note_ids: [],
    },
  },
} as unknown as HttpTypes.StoreProduct
const filters: PerfumeFilters = {
  genders: [],
  seasons: [],
  brands: [],
  notes: [],
}

describe("stable product taxonomy references", () => {
  it("keeps brand/note filters working after a rename, including decants", () => {
    for (const listing_type of ["full_perfume", "decant"]) {
      const entry = {
        ...product,
        metadata: { ...product.metadata, listing_type },
      }
      expect(
        filterPerfumeProducts(
          [entry],
          { ...filters, brands: ["designer_1"], notes: ["note_1"] },
          undefined,
          items,
        ),
      ).toEqual([entry])
      expect(
        filterPerfumeProducts(
          [entry],
          { ...filters, brands: ["New brand"], notes: ["Нова нотка"] },
          undefined,
          items,
        ),
      ).toEqual([entry])
    }
  })
  it("does not let stale names match an explicitly cleared/different reference", () => {
    const entry = {
      ...product,
      metadata: {
        ...product.metadata,
        brand: "New brand",
        perfume_notes: ["Нова нотка"],
        perfume_profile: {
          designer_id: "other",
          top_note_ids: [],
          heart_note_ids: [],
          base_note_ids: [],
        },
      },
    }
    expect(
      filterPerfumeProducts(
        [entry],
        { ...filters, brands: ["designer_1"] },
        undefined,
        items,
      ),
    ).toEqual([])
    expect(
      filterPerfumeProducts(
        [entry],
        { ...filters, notes: ["note_1"] },
        undefined,
        items,
      ),
    ).toEqual([])
  })
  it("resolves current labels without mutating stored metadata or the URL", () => {
    const resolved = resolveProductTaxonomy(product, items)
    expect(resolved.title).toBe("New brand Aroma")
    expect(resolved.metadata?.brand).toBe("New brand")
    expect(resolved.metadata?.perfume_notes).toEqual(["Нова нотка"])
    expect(resolved.handle).toBe("aroma")
    expect(product.metadata?.brand).toBe("Old brand")
    expect(catalogBrandOptions([resolved])).toEqual([
      { value: "designer_1", label: "New brand" },
    ])
  })
  it("supports legacy name-only products on ID-based taxonomy pages", () => {
    const entry = {
      ...product,
      metadata: {
        catalog_visible: true,
        brand: "New brand",
        perfume_notes: ["Нова нотка"],
      },
    }
    expect(
      filterPerfumeProducts(
        [entry],
        { ...filters, brands: ["designer_1"], notes: ["note_1"] },
        undefined,
        items,
      ),
    ).toEqual([entry])
    expect(
      catalogBrandOptions(
        [resolveProductTaxonomy(product, items), entry],
        items,
      ),
    ).toEqual([{ value: "designer_1", label: "New brand" }])
  })
})
