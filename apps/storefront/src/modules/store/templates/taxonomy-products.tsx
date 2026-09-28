import { PerfumeFilters } from "@lib/util/perfume-filters"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { Suspense } from "react"

import PaginatedProducts from "./paginated-products"

export default function TaxonomyProductsTemplate({
  label,
  title,
  description,
  countryCode,
  page,
  sortBy,
  perfumeFilters,
}: {
  label: string
  title: string
  description: string
  countryCode: string
  page?: string
  sortBy?: SortOptions
  perfumeFilters: PerfumeFilters
}) {
  return (
    <div className="bg-[#fbf9f6]">
      <section className="border-b border-[#ded7cf] bg-[#eee8df] py-7 small:py-8">
        <div className="content-container">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#826c5a]">
            {label}
          </p>
          <h1 className="font-display mt-1 text-3xl tracking-[-0.02em] small:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#695e54]">
            {description}
          </p>
        </div>
      </section>

      <section className="content-container py-8 small:py-12">
        <Suspense fallback={<SkeletonProductGrid />}>
          <PaginatedProducts
            sortBy={sortBy ?? "created_at"}
            page={page ? parseInt(page) : 1}
            countryCode={countryCode}
            perfumeFilters={perfumeFilters}
          />
        </Suspense>
      </section>
    </div>
  )
}
