import { HttpTypes } from "@medusajs/types"
import { getPerfumeProfile } from "@modules/products/data/perfume-profiles"

import { getProductPrice } from "./get-product-price"

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
  searchParams: SearchParams
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

const fieldValues = (
  product: HttpTypes.StoreProduct,
  keys: string[]
) => {
  const metadataValues = keys.flatMap((key) =>
    splitValues(product.metadata?.[key])
  )
  const tagValues =
    product.tags?.flatMap((tag) => splitValues(tag.value)) ?? []

  return [...metadataValues, ...tagValues]
}

const matchesAny = (productValues: string[], selected: string[]) => {
  if (!selected.length) {
    return true
  }

  return selected.some((selectedValue) =>
    productValues.includes(selectedValue.toLocaleLowerCase())
  )
}

export const isProductVisibleInCatalog = (
  product: HttpTypes.StoreProduct
) =>
  product.metadata?.catalog_visible === true ||
  // The original local demo records predate the visibility switch. Keeping
  // them available avoids a blank development catalog; real products must
  // explicitly opt in through the admin profile.
  product.metadata?.demo === true

export const filterPerfumeProducts = (
  products: HttpTypes.StoreProduct[],
  filters?: PerfumeFilters,
  listingType?: PerfumeListingType
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
    const matchesBrand =
      !activeFilters.brands.length ||
      activeFilters.brands.some((brand) =>
        brandValues.some((value) =>
          value.includes(brand.toLocaleLowerCase())
        )
      )
    const matchesNotes = matchesAny(noteValues, activeFilters.notes)
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
