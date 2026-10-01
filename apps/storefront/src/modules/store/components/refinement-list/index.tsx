"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"

import PerfumeFilters from "./perfume-filters"
import SortProducts, { SortOptions } from "./sort-products"

type RefinementListProps = {
  sortBy: SortOptions
  brands?: { value: string; label: string }[]
  priceMax?: number
  search?: boolean
  hideOptionsPicker?: boolean
  "data-testid"?: string
}

const RefinementList = ({
  sortBy,
  brands,
  priceMax,
  hideOptionsPicker = false,
  "data-testid": dataTestId,
}: RefinementListProps) => {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateQueryParams = useCallback(
    (updater: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString())
      updater(params)

      params.delete("page")

      const queryString = params.toString()
      const currentQuery = searchParams.toString()
      const nextPath = queryString ? `${pathname}?${queryString}` : pathname
      const currentPath = currentQuery
        ? `${pathname}?${currentQuery}`
        : pathname

      if (nextPath !== currentPath) {
        router.push(nextPath)
      }
    },
    [pathname, router, searchParams],
  )

  const setQueryParams = (name: string, value: string) =>
    updateQueryParams((params) => params.set(name, value))

  const controls = hideOptionsPicker ? (
    <SortProducts
      sortBy={sortBy}
      setQueryParams={setQueryParams}
      data-testid={dataTestId}
    />
  ) : (
    <PerfumeFilters brands={brands || []} priceMax={priceMax || 1000}>
      <SortProducts
        sortBy={sortBy}
        setQueryParams={setQueryParams}
        data-testid={dataTestId}
      />
    </PerfumeFilters>
  )

  return (
    <>
      <div className="mb-1 small:hidden">
        <button
          type="button"
          aria-expanded={mobileFiltersOpen}
          aria-controls="mobile-perfume-filters"
          onClick={() => setMobileFiltersOpen((open) => !open)}
          className="flex h-11 w-full items-center justify-between border border-[#d4c9be] bg-[#eee8df] px-4 text-sm font-semibold text-[#302a25]"
        >
          <span>Филтри и подреждане</span>
          <span aria-hidden="true">{mobileFiltersOpen ? "−" : "+"}</span>
        </button>
        {mobileFiltersOpen && (
          <aside
            id="mobile-perfume-filters"
            className="max-h-[70vh] w-full overflow-y-auto border-x border-b border-[#d4c9be] bg-[#eee8df] p-5"
          >
            {controls}
          </aside>
        )}
      </div>

      <aside className="hidden w-full shrink-0 border border-[#d4c9be] bg-[#eee8df] p-5 shadow-[0_8px_24px_rgba(55,42,31,0.05)] small:block small:w-[220px]">
        {controls}
      </aside>
    </>
  )
}

export default RefinementList
