import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getPerfumeTaxonomyBySlug } from "@lib/data/perfume-taxonomies"
import { parsePerfumeFilters } from "@lib/util/perfume-filters"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import TaxonomyProductsTemplate from "@modules/store/templates/taxonomy-products"

type PageProps = {
  params: Promise<{ countryCode: string; handle: string }>
  searchParams: Promise<
    Record<string, string | string[] | undefined> & {
      page?: string
      sortBy?: SortOptions
    }
  >
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { handle } = await params
  const note = await getPerfumeTaxonomyBySlug("note", handle)

  return {
    title: note ? `Парфюми с ${note.name}` : "Парфюмна нотка",
    description: note
      ? `Разгледайте всички налични парфюми с нотка ${note.name}.`
      : "Разгледайте ароматите според техните парфюмни нотки.",
    alternates: { canonical: `/parfyumni-notki/${handle}` },
  }
}

export default async function PerfumeNotePage({
  params,
  searchParams,
}: PageProps) {
  const [{ countryCode, handle }, query] = await Promise.all([
    params,
    searchParams,
  ])
  const note = await getPerfumeTaxonomyBySlug("note", handle)

  if (!note) notFound()

  return (
    <TaxonomyProductsTemplate
      label="Парфюмна нотка"
      title={note.name}
      description={`Всички налични аромати, в чиято композиция присъства ${note.name}.`}
      countryCode={countryCode}
      page={typeof query.page === "string" ? query.page : undefined}
      sortBy={query.sortBy}
      perfumeFilters={{ ...parsePerfumeFilters(query), notes: [note.id] }}
    />
  )
}
