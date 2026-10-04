import { Suspense } from "react"
import type { OptionValueIds } from "@lib/util/product-option-filters"
import type {
  PerfumeFilters,
  PerfumeListingType,
} from "@lib/util/perfume-filters"
import type { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import CatalogResults from "./catalog-results"
import CatalogLoading from "./catalog-loading"

export type StoreTemplateProps = {
  sortBy?: SortOptions
  page?: string
  countryCode: string
  searchQuery?: string
  perfumeFilters: PerfumeFilters
  optionValueIds?: OptionValueIds
  catalogLabel?: string
  catalogTitle?: string
  listingType?: PerfumeListingType
}

export default function StoreTemplate(props: StoreTemplateProps) {
  const {
    catalogLabel = "Каталог",
    catalogTitle = "Всички аромати",
    searchQuery,
  } = props
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
      {/* The data request must happen inside the boundary, not before it. A new
        page/filter query gets its own loading state instead of stale results. */}
      <Suspense key={JSON.stringify(props)} fallback={<CatalogLoading />}>
        <CatalogResults {...props} />
      </Suspense>
    </div>
  )
}
