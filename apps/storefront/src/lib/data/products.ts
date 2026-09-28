"use server"

import { sdk } from "@lib/config"
import { OptionValueIds } from "@lib/util/product-option-filters"
import {
  filterPerfumeProducts,
  PerfumeFilters,
  PerfumeListingType,
} from "@lib/util/perfume-filters"
import { sortProducts } from "@lib/util/sort-products"
import { HttpTypes } from "@medusajs/types"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { getRegion, retrieveRegion } from "./regions"

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

  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("products")),
  }

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
        next,
        cache:
          process.env.NODE_ENV === "development" ? "no-store" : "force-cache",
      },
    )
    .then(({ products, count }) => {
      const nextPage = count > offset + limit ? pageParam + 1 : null

      return {
        response: {
          products,
          count,
        },
        nextPage: nextPage,
        queryParams,
      }
    })
}

/**
 * Fetch every page for catalog views that apply perfume-specific metadata
 * filters and sorting in the storefront. Medusa's store endpoint is still
 * paginated, so requesting one large page silently omitted products beyond
 * the first 100.
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
 * This will fetch 100 products to the Next.js cache and sort them based on the sortBy parameter.
 * It will then return the paginated products based on the page and limit parameters.
 */
export const listProductsWithSort = async ({
  page = 0,
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
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: ProductListQueryParams
}> => {
  const limit = queryParams?.limit || 12
  const optionFilters = Array.from(
    new Set((optionValueIds || []).filter(Boolean)),
  )

  const products = await listAllProducts({
    queryParams: {
      ...queryParams,
      ...(optionFilters.length ? { option_value_id: optionFilters } : {}),
    },
    countryCode,
  })

  const filteredProducts = filterPerfumeProducts(
    products,
    perfumeFilters,
    listingType,
  )
  const sortedProducts = sortProducts(filteredProducts, sortBy)

  const pageParam = (page - 1) * limit

  const filteredCount = filteredProducts.length

  const nextPage = filteredCount > pageParam + limit ? pageParam + limit : null

  const paginatedProducts = sortedProducts.slice(pageParam, pageParam + limit)

  return {
    response: {
      products: paginatedProducts,
      count: filteredCount,
    },
    nextPage,
    queryParams,
  }
}
