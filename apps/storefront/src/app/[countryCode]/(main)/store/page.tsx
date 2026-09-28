import { Metadata } from "next"

import { parseOptionValueIds } from "@lib/util/product-option-filters"
import { parsePerfumeFilters } from "@lib/util/perfume-filters"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"

export const metadata: Metadata = {
  title: "Всички аромати",
  description: "Разгледайте цялата ни селекция от парфюми.",
}

type StorePageSearchParams = Record<string, string | string[] | undefined> & {
  sortBy?: SortOptions
  page?: string
  q?: string
  optionValueIds?: string | string[]
}

type Params = {
  searchParams: Promise<StorePageSearchParams>
  params: Promise<{
    countryCode: string
  }>
}

export default async function StorePage(props: Params) {
  const params = await props.params
  const searchParams = await props.searchParams
  const { sortBy, page, q } = searchParams
  const optionValueIds = parseOptionValueIds(searchParams)
  const perfumeFilters = parsePerfumeFilters(searchParams)

  return (
    <StoreTemplate
      sortBy={sortBy}
      page={page}
      countryCode={params.countryCode}
      searchQuery={typeof q === "string" ? q : undefined}
      perfumeFilters={perfumeFilters}
      optionValueIds={optionValueIds}
    />
  )
}
