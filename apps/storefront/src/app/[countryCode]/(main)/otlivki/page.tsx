import { Metadata } from "next"

import { parsePerfumeFilters } from "@lib/util/perfume-filters"
import { parseOptionValueIds } from "@lib/util/product-option-filters"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"

export const metadata: Metadata = {
  title: "Парфюмни отливки",
  description: "Парфюмни отливки в разфасовки от 5 мл и 10 мл.",
  alternates: { canonical: "/otlivki" },
}

type PageSearchParams = Record<string, string | string[] | undefined> & {
  sortBy?: SortOptions
  page?: string
  q?: string
  optionValueIds?: string | string[]
}

type Params = {
  searchParams: Promise<PageSearchParams>
  params: Promise<{ countryCode: string }>
}

export default async function DecantsCatalogPage(props: Params) {
  const [params, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ])
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
