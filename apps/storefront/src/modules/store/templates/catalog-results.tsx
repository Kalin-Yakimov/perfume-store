import { listCatalogProducts } from "@lib/data/catalog"
import { getRegion } from "@lib/data/regions"
import { parsePage } from "@lib/util/parse-page"
import RefinementList from "@modules/store/components/refinement-list"
import PaginatedProducts from "./paginated-products"
import type { StoreTemplateProps } from "."

export default async function CatalogResults({
  sortBy = "created_at",
  page,
  countryCode,
  searchQuery,
  perfumeFilters,
  optionValueIds,
  listingType = "full_perfume",
}: StoreTemplateProps) {
  const pageNumber = parsePage(page, 25_001)
  const region = await getRegion(countryCode)
  if (!region) throw new Error("Catalog region is unavailable")
  const result = await listCatalogProducts({
    countryCode,
    page: pageNumber,
    limit: 40,
    sortBy,
    query: searchQuery,
    filters: perfumeFilters,
    listingType,
    optionValueIds,
    facets: true,
  })
  return (
    <div
      className="content-container flex flex-col gap-7 py-8 small:flex-row small:items-start small:gap-8 small:py-12"
      data-testid="category-container"
    >
      <RefinementList
        sortBy={sortBy}
        brands={result.facets.brands}
        priceMax={result.facets.price_max}
      />
      <div className="w-full">
        <PaginatedProducts
          sortBy={sortBy}
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
      </div>
    </div>
  )
}
