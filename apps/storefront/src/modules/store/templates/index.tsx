import { Suspense } from "react"

import { listCatalogProducts } from "@lib/data/catalog"
import { getRegion } from "@lib/data/regions"
import { OptionValueIds } from "@lib/util/product-option-filters"
import { PerfumeFilters, PerfumeListingType } from "@lib/util/perfume-filters"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@modules/store/components/refinement-list"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

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
  const parsedPage = Number(page || 1)
  const pageNumber =
    Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const sort = sortBy || "created_at"
  const region = await getRegion(countryCode)

  if (!region) return null

  const result = await listCatalogProducts({
    countryCode,
    page: pageNumber,
    limit: 40,
    sortBy: sort,
    query: searchQuery,
    filters: perfumeFilters,
    listingType,
    optionValueIds,
    facets: true,
  })
  const brands = result.facets.brands
  const priceMax = result.facets.price_max

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
              preloadedProducts={result.products}
              unavailableProductIds={result.unavailable_product_ids}
              preloadedCount={result.count}
              preloadedRegion={region}
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

export default StoreTemplate
