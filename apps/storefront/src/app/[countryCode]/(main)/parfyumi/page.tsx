import { Metadata } from "next"

import { parseOptionValueIds } from "@lib/util/product-option-filters"
import { parsePerfumeFilters } from "@lib/util/perfume-filters"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"

type StorePageSearchParams = Record<string, string | string[] | undefined> & {
  sortBy?: SortOptions
  page?: string
  q?: string
  optionValueIds?: string | string[]
}

type Params = {
  searchParams: Promise<StorePageSearchParams>
  params: Promise<{ countryCode: string }>
}

export async function generateMetadata({ searchParams }: Params): Promise<Metadata> {
  const { q } = await searchParams
  const isSearch = (Array.isArray(q) ? q : [q]).some((value) => value?.trim())

  return {
    title: isSearch ? "Търсене на парфюми" : "Всички аромати",
    description: "Разгледайте цялата ни селекция от парфюми.",
    alternates: { canonical: "/parfyumi" },
    robots: { index: !isSearch, follow: true },
  }
}

export default async function PerfumeCatalogPage(props: Params) {
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
    />
  )
}
