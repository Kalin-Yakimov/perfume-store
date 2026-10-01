import { Metadata } from "next"

import { parsePerfumeFilters } from "@lib/util/perfume-filters"
import { parseOptionValueIds } from "@lib/util/product-option-filters"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"

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

export async function generateMetadata({ searchParams }: Params): Promise<Metadata> {
  const { q } = await searchParams
  const isSearch = (Array.isArray(q) ? q : [q]).some((value) => value?.trim())

  return {
    title: isSearch ? "Търсене на отливки" : "Парфюмни отливки",
    description: "Открийте любимия си аромат с парфюмни отливки в различни разфасовки.",
    alternates: { canonical: "/otlivki" },
    robots: { index: !isSearch, follow: true },
  }
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
