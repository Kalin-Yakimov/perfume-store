import { HttpTypes } from "@medusajs/types"
import { getPerfumeProfile } from "@modules/products/data/perfume-profiles"

import { getProductPrice } from "./get-product-price"
import { productTaxonomyProfile } from "./product-taxonomy"
import type { PerfumeTaxonomyItem } from "@lib/data/perfume-taxonomies"

export type PerfumeFilters = {
  genders: string[]
  brands: string[]
  seasons: string[]
  notes: string[]
  minPrice?: number
  maxPrice?: number
}

export type PerfumeListingType = "full_perfume" | "decant"

type SearchParams = Record<string, string | string[] | undefined>

const toArray = (value: string | string[] | undefined) => {
  if (!value) {
    return []
  }

  return Array.isArray(value) ? value : [value]
}

const toPrice = (value: string | string[] | undefined) => {
  const rawValue = Array.isArray(value) ? value[0] : value
  const price = rawValue ? Number(rawValue) : undefined

  return Number.isFinite(price) ? price : undefined
}

export const parsePerfumeFilters = (
  searchParams: SearchParams,
): PerfumeFilters => ({
  genders: toArray(searchParams.gender),
  brands: toArray(searchParams.brand),
  seasons: toArray(searchParams.season),
  notes: toArray(searchParams.note),
  minPrice: toPrice(searchParams.minPrice),
  maxPrice: toPrice(searchParams.maxPrice),
})

const splitValues = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap(splitValues)
  }

  if (typeof value !== "string") {
    return []
  }

  return value
    .split(/[,/|]/)
    .map((item) => item.trim().toLocaleLowerCase())
    .filter(Boolean)
}

const fieldValues = (product: HttpTypes.StoreProduct, keys: string[]) => {
  const metadataValues = keys.flatMap((key) =>
    splitValues(product.metadata?.[key]),
  )
  const tagValues = product.tags?.flatMap((tag) => splitValues(tag.value)) ?? []

  return [...metadataValues, ...tagValues]
}

const matchesAny = (productValues: string[], selected: string[]) => {
  if (!selected.length) {
    return true
  }

  return selected.some((selectedValue) =>
    productValues.includes(selectedValue.toLocaleLowerCase()),
  )
}

export const isProductVisibleInCatalog = (
  product: Pick<HttpTypes.StoreProduct, "metadata">,
) =>
  product.metadata?.catalog_visible === true ||
  // The original local demo records predate the visibility switch. Keeping
  // them available avoids a blank development catalog; real products must
  // explicitly opt in through the admin profile.
  product.metadata?.demo === true

export const filterPerfumeProducts = (
  products: HttpTypes.StoreProduct[],
  filters?: PerfumeFilters,
  listingType?: PerfumeListingType,
  taxonomyItems: PerfumeTaxonomyItem[] = [],
) => {
  const activeFilters: PerfumeFilters = filters || {
    genders: [],
    brands: [],
    seasons: [],
    notes: [],
  }

  return products.filter((product) => {
    // Visibility is deliberately separate from Medusa's Published/Draft
    // status. Products without an explicit opt-in are private by default.
    const isVisibleInCatalog = isProductVisibleInCatalog(product)
    const productListingType = product.metadata?.listing_type
    const matchesListingType =
      !listingType ||
      (listingType === "full_perfume"
        ? productListingType !== "decant"
        : productListingType === "decant")
    const genderValues = fieldValues(product, ["gender", "sex"])
    const seasonValues = fieldValues(product, ["season", "seasons"])
    const brandValues = [
      ...fieldValues(product, ["brand", "designer"]),
      ...splitValues(product.collection?.title),
      product.title.toLocaleLowerCase(),
    ]
    const profile = getPerfumeProfile(product.handle)
    const storedProfile = productTaxonomyProfile(product)
    const noteKeys = ["top_note_ids", "heart_note_ids", "base_note_ids"]
    const noteIds = noteKeys.flatMap((key) =>
      Array.isArray(storedProfile[key]) ? (storedProfile[key] as string[]) : [],
    )
    const noteValues = [
      ...fieldValues(product, [
        "notes",
        "perfume_notes",
        "top_notes",
        "heart_notes",
        "base_notes",
      ]),
      ...(profile
        ? [
            ...profile.notes.top,
            ...profile.notes.heart,
            ...profile.notes.base,
          ].map((note) => note.toLocaleLowerCase())
        : []),
    ]
    const price = getProductPrice({ product }).cheapestPrice
      ?.calculated_price_number

    const matchesGender = matchesAny(genderValues, activeFilters.genders)
    const matchesSeason = matchesAny(seasonValues, activeFilters.seasons)
    const taxonomyMatch = (kind: "designer" | "note", selected: string) =>
      taxonomyItems.find(
        (item) =>
          item.kind === kind &&
          (item.id === selected ||
            item.name.toLocaleLowerCase("bg") ===
              selected.toLocaleLowerCase("bg")),
      )
    const matchesBrand =
      !activeFilters.brands.length ||
      activeFilters.brands.some((brand) => {
        const taxonomy = taxonomyMatch("designer", brand)
        if (
          typeof storedProfile.designer_id === "string" &&
          storedProfile.designer_id
        ) {
          if (taxonomy || brand === storedProfile.designer_id)
            return storedProfile.designer_id === (taxonomy?.id || brand)
        }
        const label = taxonomy?.name || brand
        return brandValues.some((value) =>
          value.includes(label.toLocaleLowerCase()),
        )
      })
    const matchesNotes =
      !activeFilters.notes.length ||
      activeFilters.notes.some((note) => {
        const taxonomy = taxonomyMatch("note", note)
        if (
          noteKeys.some((key) =>
            Object.prototype.hasOwnProperty.call(storedProfile, key),
          )
        ) {
          return noteIds.includes(taxonomy?.id || note)
        }
        return matchesAny(noteValues, [taxonomy?.name || note])
      })
    const matchesMinimum =
      activeFilters.minPrice === undefined ||
      (price !== undefined && price >= activeFilters.minPrice)
    const matchesMaximum =
      activeFilters.maxPrice === undefined ||
      (price !== undefined && price <= activeFilters.maxPrice)

    return (
      isVisibleInCatalog &&
      matchesListingType &&
      matchesGender &&
      matchesBrand &&
      matchesSeason &&
      matchesNotes &&
      matchesMinimum &&
      matchesMaximum
    )
  })
}
