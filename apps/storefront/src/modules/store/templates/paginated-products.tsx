import { listProductsWithSort } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { HttpTypes } from "@medusajs/types"
import { OptionValueIds } from "@lib/util/product-option-filters"
import { PerfumeFilters, PerfumeListingType } from "@lib/util/perfume-filters"
import ProductPreview from "@modules/products/components/product-preview"
import { Pagination } from "@modules/store/components/pagination"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

const PRODUCT_LIMIT = 40

type PaginatedProductsParams = {
  limit: number
  collection_id?: string[]
  category_id?: string[]
  id?: string[]
  order?: string
  q?: string
}

export default async function PaginatedProducts({
  sortBy,
  page,
  collectionId,
  categoryId,
  productsIds,
  countryCode,
  searchQuery,
  perfumeFilters,
  optionValueIds,
  listingType,
  preloadedProducts,
  unavailableProductIds = [],
  preloadedCount,
  preloadedRegion,
}: {
  sortBy?: SortOptions
  page: number
  collectionId?: string
  categoryId?: string
  productsIds?: string[]
  countryCode: string
  searchQuery?: string
  perfumeFilters?: PerfumeFilters
  optionValueIds?: OptionValueIds
  listingType?: PerfumeListingType
  preloadedProducts?: HttpTypes.StoreProduct[]
  unavailableProductIds?: string[]
  preloadedCount?: number
  preloadedRegion?: HttpTypes.StoreRegion
}) {
  const queryParams: PaginatedProductsParams = {
    limit: PRODUCT_LIMIT,
  }

  if (collectionId) {
    queryParams["collection_id"] = [collectionId]
  }

  if (categoryId) {
    queryParams["category_id"] = [categoryId]
  }

  if (productsIds) {
    queryParams["id"] = productsIds
  }

  if (sortBy === "created_at") {
    queryParams["order"] = "created_at"
  }

  if (searchQuery) {
    queryParams["q"] = searchQuery
  }

  const region = preloadedRegion || (await getRegion(countryCode))

  if (!region) {
    return null
  }

  let products = preloadedProducts
  let count = preloadedCount ?? 0

  if (products === undefined) {
    const result = await listProductsWithSort({
      page,
      queryParams,
      sortBy,
      countryCode,
      perfumeFilters,
      optionValueIds,
      listingType,
    })
    products = result.response.products
    count = result.response.count
    unavailableProductIds = result.response.unavailableProductIds
  }

  const totalPages = Math.ceil(count / PRODUCT_LIMIT)
  const unavailable = new Set(unavailableProductIds)

  return (
    <>
      {products.length ? (
        <ul
          className="grid w-full grid-cols-2 gap-4 small:grid-cols-4"
          data-testid="products-list"
        >
          {products.map((p, index) => {
            return (
              <li
                key={p.id}
                className={`border bg-[#fffdf9] p-3 transition duration-300 ${unavailable.has(p.id) ? "border-[#e4dfd9]" : "border-[#ded7cf] hover:-translate-y-0.5 hover:border-[#bba999] hover:shadow-[0_14px_32px_rgba(52,40,30,0.10)]"}`}
              >
                <ProductPreview
                  product={p}
                  region={region}
                  unavailable={unavailable.has(p.id)}
                  priority={index < 2}
                />
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="border-y border-[#ded7cf] py-16 text-center">
          <h2 className="font-display text-2xl">Няма намерени парфюми</h2>
          <p className="mt-3 text-sm text-[#74695f]">
            Опитайте с друго име или разгледайте целия каталог.
          </p>
        </div>
      )}
      {totalPages > 1 && (
        <Pagination
          data-testid="product-pagination"
          page={page}
          totalPages={totalPages}
        />
      )}
    </>
  )
}
