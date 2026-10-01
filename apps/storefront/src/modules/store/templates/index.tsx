import { Suspense } from "react"

import { listAllProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { getProductPrice } from "@lib/util/get-product-price"
import { OptionValueIds } from "@lib/util/product-option-filters"
import {
  filterPerfumeProducts,
  PerfumeFilters,
  PerfumeListingType,
} from "@lib/util/perfume-filters"
import { sortProducts } from "@lib/util/sort-products"
import { getUnavailableProductIds } from "@lib/data/product-availability"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { HttpTypes } from "@medusajs/types"
import { listPerfumeTaxonomies } from "@lib/data/perfume-taxonomies"
import { catalogBrandOptions } from "@lib/util/product-taxonomy"

import PaginatedProducts from "./paginated-products"

const StoreTemplate = async ({
  sortBy,
  page,
  countryCode,
  searchQuery,
  perfumeFilters,
  optionValueIds,
  catalogLabel = "Каталог",
  catalogTitle = "Всички аромати",
  listingType = "full_perfume",
}: {
  sortBy?: SortOptions
  page?: string
  countryCode: string
  searchQuery?: string
  perfumeFilters: PerfumeFilters
  optionValueIds?: OptionValueIds
  catalogLabel?: string
  catalogTitle?: string
  listingType?: PerfumeListingType
}) => {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"
  const region = await getRegion(countryCode)

  if (!region) return null

  const queryParams: HttpTypes.StoreProductListParams & {
    option_value_id?: string[]
  } = {
    limit: 100,
    ...(searchQuery ? { q: searchQuery } : {}),
    ...(optionValueIds?.length ? { option_value_id: optionValueIds } : {}),
  }
  const products = await listAllProducts({ queryParams, countryCode })
  const taxonomies = await listPerfumeTaxonomies()
  const catalogProducts = filterPerfumeProducts(
    products,
    undefined,
    listingType,
    taxonomies,
  )
  const filteredProducts = filterPerfumeProducts(
    products,
    perfumeFilters,
    listingType,
    taxonomies,
  )
  const unavailableIds = new Set(
    await getUnavailableProductIds(filteredProducts),
  )
  const sortedByPreference = sortProducts(filteredProducts, sort)
  const sortedProducts = [
    ...sortedByPreference.filter((product) => !unavailableIds.has(product.id)),
    ...sortedByPreference.filter((product) => unavailableIds.has(product.id)),
  ]
  const start = (pageNumber - 1) * 40
  const pageProducts = sortedProducts.slice(start, start + 40)
  const brands = catalogBrandOptions(catalogProducts, taxonomies)
  const highestCatalogPrice = catalogProducts.reduce((highest, product) => {
    const price = getProductPrice({ product }).cheapestPrice
      ?.calculated_price_number
    return typeof price === "number" ? Math.max(highest, price) : highest
  }, 0)
  const priceMax = catalogProducts.length
    ? Math.max(5, Math.ceil(highestCatalogPrice / 5) * 5)
    : 100

  return (
    <div className="bg-[#fbf9f6]">
      <div className="border-b border-[#ded7cf] bg-[#eee8df] py-7 small:py-8">
        <div className="content-container">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#826c5a]">
            {catalogLabel}
          </p>
          <h1
            className="font-display mt-1 text-3xl tracking-[-0.02em] small:text-4xl"
            data-testid="store-page-title"
          >
            {searchQuery ? `Резултати за „${searchQuery}“` : catalogTitle}
          </h1>
        </div>
      </div>

      <div
        className="content-container flex flex-col gap-7 py-8 small:flex-row small:items-start small:gap-8 small:py-12"
        data-testid="category-container"
      >
        <RefinementList sortBy={sort} brands={brands} priceMax={priceMax} />
        <div className="w-full">
          <Suspense fallback={<SkeletonProductGrid />}>
            <PaginatedProducts
              sortBy={sort}
              page={pageNumber}
              countryCode={countryCode}
              searchQuery={searchQuery}
              perfumeFilters={perfumeFilters}
              optionValueIds={optionValueIds}
              listingType={listingType}
              preloadedProducts={pageProducts}
              unavailableProductIds={Array.from(unavailableIds)}
              preloadedCount={filteredProducts.length}
              preloadedRegion={region}
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

export default StoreTemplate
