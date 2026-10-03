"use server"

import { sdk } from "@lib/config"
import { OptionValueIds } from "@lib/util/product-option-filters"
import {
  filterPerfumeProducts,
  PerfumeFilters,
  PerfumeListingType,
} from "@lib/util/perfume-filters"
import { HttpTypes } from "@medusajs/types"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { getAuthHeaders } from "./cookies"
import { getPublicCacheOptions } from "./cache-policy"
import { getRegion, retrieveRegion } from "./regions"
import { listCatalogProducts } from "./catalog"
import { listPerfumeTaxonomies } from "./perfume-taxonomies"
import { resolveProductTaxonomy } from "@lib/util/product-taxonomy"

type ProductListQueryParams = (HttpTypes.FindParams &
  HttpTypes.StoreProductListParams) & {
  options?: string[]
  option_value_id?: string | string[]
}

export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
  regionId,
}: {
  pageParam?: number
  queryParams?: ProductListQueryParams
  countryCode?: string
  regionId?: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: ProductListQueryParams
}> => {
  if (!countryCode && !regionId) {
    throw new Error("Country code or region ID is required")
  }

  const limit = queryParams?.limit || 12
  const _pageParam = Math.max(pageParam, 1)
  const offset = _pageParam === 1 ? 0 : (_pageParam - 1) * limit

  let region: HttpTypes.StoreRegion | undefined | null

  if (countryCode) {
    region = await getRegion(countryCode)
  } else {
    region = await retrieveRegion(regionId!)
  }

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    }
  }

  const authHeaders = await getAuthHeaders()
  const headers = { ...authHeaders }

  const cacheOptions = getPublicCacheOptions(
    "products",
    Boolean(authHeaders.authorization),
  )

  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[]; count: number }>(
      `/store/products`,
      {
        method: "GET",
        query: {
          limit,
          offset,
          region_id: region?.id,
          fields:
            "*variants.calculated_price,+variants.inventory_quantity,+variants.manage_inventory,+variants.allow_backorder,+variants.metadata,*variants.images,*variants.options,+metadata,+tags,",
          ...queryParams,
        },
        headers,
        ...cacheOptions,
      },
    )
    .then(async ({ products, count }) => {
      const taxonomies = products.some(
        (product) => product.metadata?.perfume_profile,
      )
        ? await listPerfumeTaxonomies()
        : []
      const nextPage = count > offset + limit ? pageParam + 1 : null

      return {
        response: {
          products: products.map((product) =>
            resolveProductTaxonomy(product, taxonomies),
          ),
          count,
        },
        nextPage: nextPage,
        queryParams,
      }
    })
}

/**
 * Explicit full traversal for background/export consumers such as sitemap.
 * Interactive catalogs use listCatalogProducts, never this full traversal.
 */
export const listAllProducts = async ({
  queryParams,
  countryCode,
}: {
  queryParams?: ProductListQueryParams
  countryCode: string
}): Promise<HttpTypes.StoreProduct[]> => {
  const pageSize = 100
  const firstPage = await listProducts({
    pageParam: 1,
    queryParams: { ...queryParams, limit: pageSize },
    countryCode,
  })
  const pageCount = Math.ceil(firstPage.response.count / pageSize)

  if (pageCount <= 1) {
    return firstPage.response.products
  }

  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      listProducts({
        pageParam: index + 2,
        queryParams: { ...queryParams, limit: pageSize },
        countryCode,
      }),
    ),
  )

  return [
    ...firstPage.response.products,
    ...remainingPages.flatMap(({ response }) => response.products),
  ]
}

/**
 * Compatibility wrapper for collection/designer/note listing pages. Filtering
 * and pagination are executed by the backend, not against a full product list.
 */
export const listProductsWithSort = async ({
  page = 1,
  queryParams,
  sortBy = "created_at",
  countryCode,
  optionValueIds,
  perfumeFilters,
  listingType,
}: {
  page?: number
  queryParams?: ProductListQueryParams
  sortBy?: SortOptions
  countryCode: string
  optionValueIds?: OptionValueIds
  perfumeFilters?: PerfumeFilters
  listingType?: PerfumeListingType
}): Promise<{
  response: {
    products: HttpTypes.StoreProduct[]
    count: number
    unavailableProductIds: string[]
  }
  nextPage: number | null
  queryParams?: ProductListQueryParams
}> => {
  const limit = queryParams?.limit || 12
  const optionFilters = Array.from(
    new Set((optionValueIds || []).filter(Boolean)),
  )

  const asArray = (value?: string | string[]) =>
    value ? (Array.isArray(value) ? value : [value]) : undefined
  const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1
  const result = await listCatalogProducts({
    countryCode,
    page: safePage,
    limit,
    sortBy,
    query: queryParams?.q,
    filters: perfumeFilters,
    listingType,
    optionValueIds: optionFilters.length
      ? optionFilters
      : asArray(queryParams?.option_value_id),
    categoryIds: asArray(queryParams?.category_id),
    collectionIds: asArray(queryParams?.collection_id),
    productIds: asArray(queryParams?.id),
  })
  const nextPage = result.count > safePage * limit ? safePage + 1 : null

  return {
    response: {
      products: result.products,
      count: result.count,
      unavailableProductIds: result.unavailable_product_ids,
    },
    nextPage,
    queryParams,
  }
}

/** Fetch only linked IDs, then let the Store API enforce channel and price context. */
export async function listLinkedDecants(
  sourceProductId: string,
  countryCode: string,
) {
  const products: HttpTypes.StoreProduct[] = []
  const limit = 100
  for (let offset = 0; ; offset += limit) {
    const linked = await sdk.client.fetch<{
      product_ids: string[]
      count: number
    }>("/store/linked-decants", {
      query: { source_product_id: sourceProductId, limit, offset },
      cache: "no-store",
    })
    if (linked.product_ids.length) {
      const { response } = await listProducts({
        countryCode,
        queryParams: { id: linked.product_ids, limit },
      })
      products.push(
        ...response.products.filter(
          (product) =>
            product.metadata?.listing_type === "decant" &&
            product.metadata?.decant_source_product_id === sourceProductId &&
            filterPerfumeProducts([product], undefined, "decant").length > 0,
        ),
      )
    }
    if (offset + limit >= linked.count || !linked.product_ids.length)
      return products
  }
}
