import { Metadata } from "next"

import { parsePerfumeFilters } from "@lib/util/perfume-filters"
import { parseOptionValueIds } from "@lib/util/product-option-filters"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"

export const metadata: Metadata = {
  title: "Парфюмни отливки",
  description: "Парфюмни отливки в разфасовки от 5 мл и 10 мл.",
}

type SamplesPageSearchParams = Record<string, string | string[] | undefined> & {
  sortBy?: SortOptions
  page?: string
  q?: string
  optionValueIds?: string | string[]
}

type Params = {
  searchParams: Promise<SamplesPageSearchParams>
  params: Promise<{ countryCode: string }>
}

export default async function SamplesPage(props: Params) {
  const params = await props.params
  const searchParams = await props.searchParams
  const { sortBy, page, q } = searchParams

  return (
    <StoreTemplate
      sortBy={sortBy}
      page={page}
      countryCode={params.countryCode}
      searchQuery={typeof q === "string" ? q : undefined}
      perfumeFilters={parsePerfumeFilters(searchParams)}
      optionValueIds={parseOptionValueIds(searchParams)}
      catalogLabel="Отливки · 5 мл и 10 мл"
      catalogTitle="Парфюмни отливки"
      listingType="decant"
    />
  )
}
