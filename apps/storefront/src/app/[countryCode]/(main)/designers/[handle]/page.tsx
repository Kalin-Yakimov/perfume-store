import { getPerfumeTaxonomyBySlug } from "@lib/data/perfume-taxonomies"
import { parsePerfumeFilters } from "@lib/util/perfume-filters"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import TaxonomyProductsTemplate from "@modules/store/templates/taxonomy-products"
import { Metadata } from "next"
import { notFound } from "next/navigation"

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
  const designer = await getPerfumeTaxonomyBySlug("designer", handle)

  return {
    title: designer?.name ?? "Дизайнер",
    description: designer
      ? `Разгледайте всички налични парфюми от ${designer.name}.`
      : "Разгледайте парфюмите от избраната парфюмна къща.",
  }
}

export default async function DesignerPage({
  params,
  searchParams,
}: PageProps) {
  const { countryCode, handle } = await params
  const query = await searchParams
  const designer = await getPerfumeTaxonomyBySlug("designer", handle)

  if (!designer) {
    notFound()
  }

  const filters = parsePerfumeFilters(query)

  return (
    <TaxonomyProductsTemplate
      label="Парфюмна къща"
      title={designer.name}
      description={`Всички налични аромати от ${designer.name}.`}
      countryCode={countryCode}
      page={typeof query.page === "string" ? query.page : undefined}
      sortBy={query.sortBy}
      perfumeFilters={{ ...filters, brands: [designer.id] }}
    />
  )
}
