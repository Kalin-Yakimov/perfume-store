"use server"

import { sdk } from "@lib/config"
import type { HttpTypes } from "@medusajs/types"
import type {
  PerfumeFilters,
  PerfumeListingType,
} from "@lib/util/perfume-filters"
import type { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { resolveProductTaxonomy } from "@lib/util/product-taxonomy"
import { getAuthHeaders } from "./cookies"
import { getRegion } from "./regions"
import { listPerfumeTaxonomies } from "./perfume-taxonomies"

type CatalogResponse = {
  products: HttpTypes.StoreProduct[]
  count: number
  unavailable_product_ids: string[]
  facets: { brands: { value: string; label: string }[]; price_max: number }
}

export async function listCatalogProducts({
  countryCode,
  page = 1,
  limit = 40,
  sortBy = "created_at",
  query,
  filters,
  listingType,
  optionValueIds,
  collectionIds,
  categoryIds,
  productIds,
  facets = false,
}: {
  countryCode: string
  page?: number
  limit?: number
  sortBy?: SortOptions
  query?: string
  filters?: PerfumeFilters
  listingType?: PerfumeListingType
  optionValueIds?: string[]
  collectionIds?: string[]
  categoryIds?: string[]
  productIds?: string[]
  facets?: boolean
}): Promise<CatalogResponse> {
  if (productIds && !productIds.length)
    return {
      products: [],
      count: 0,
      unavailable_product_ids: [],
      facets: { brands: [], price_max: 100 },
    }
  const region = await getRegion(countryCode)
  if (!region)
    return {
      products: [],
      count: 0,
      unavailable_product_ids: [],
      facets: { brands: [], price_max: 100 },
    }
  const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1
  const headers = await getAuthHeaders()
  const result = await sdk.client.fetch<CatalogResponse>("/store/catalog", {
    query: {
      region_id: region.id,
      limit,
      offset: (safePage - 1) * limit,
      sort: sortBy,
      facets: facets ? "true" : "false",
      ...(listingType ? { listing_type: listingType } : {}),
      ...(query ? { q: query } : {}),
      ...(filters?.genders.length ? { gender: filters.genders } : {}),
      ...(filters?.seasons.length ? { season: filters.seasons } : {}),
      ...(filters?.brands.length ? { brand: filters.brands } : {}),
      ...(filters?.notes.length ? { note: filters.notes } : {}),
      ...(filters?.minPrice !== undefined
        ? { min_price: filters.minPrice }
        : {}),
      ...(filters?.maxPrice !== undefined
        ? { max_price: filters.maxPrice }
        : {}),
      ...(optionValueIds?.length ? { option_value_id: optionValueIds } : {}),
      ...(collectionIds?.length ? { collection_id: collectionIds } : {}),
      ...(categoryIds?.length ? { category_id: categoryIds } : {}),
      ...(productIds ? { id: productIds } : {}),
    },
    headers,
    // The backend projection is already cached and invalidated. An additional
    // response cache here would stack TTLs and delay administrator changes.
    cache: "no-store",
  })
  const taxonomies = result.products.some(
    (product) => product.metadata?.perfume_profile,
  )
    ? await listPerfumeTaxonomies()
    : []
  return {
    ...result,
    products: result.products.map((product) =>
      resolveProductTaxonomy(product, taxonomies),
    ),
  }
}
