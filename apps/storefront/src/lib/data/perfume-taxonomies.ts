import { sdk } from "@lib/config"
import { cache } from "react"
import {
  perfumeDesigners,
  perfumeNotes,
} from "@modules/products/data/perfume-taxonomy"

export type PerfumeTaxonomyKind = "designer" | "note" | "accord"

export type PerfumeTaxonomyItem = {
  id: string
  kind: PerfumeTaxonomyKind
  name: string
  original_name: string | null
  slug: string
  image_url: string | null
}

const fallbackItems: PerfumeTaxonomyItem[] = [
  ...perfumeDesigners.map((item) => ({
    ...item,
    id: `fallback-designer-${item.slug}`,
    kind: "designer" as const,
    original_name: null,
    image_url: null,
  })),
  ...perfumeNotes.map((item) => ({
    ...item,
    id: `fallback-note-${item.slug}`,
    kind: "note" as const,
    original_name: null,
    image_url: null,
  })),
]

export const listPerfumeTaxonomies = cache(
  async (kind?: PerfumeTaxonomyKind): Promise<PerfumeTaxonomyItem[]> => {
    try {
      const query = kind ? `?kind=${kind}` : ""
      const { items } = await sdk.client.fetch<{
        items: PerfumeTaxonomyItem[]
      }>(`/store/perfume-taxonomies${query}`, {
        cache: "no-store",
      })

      return items.length
        ? items
        : fallbackItems.filter((item) => !kind || item.kind === kind)
    } catch {
      return fallbackItems.filter((item) => !kind || item.kind === kind)
    }
  },
)

export const getPerfumeTaxonomyBySlug = async (
  kind: PerfumeTaxonomyKind,
  slug: string,
) => {
  const items = await listPerfumeTaxonomies(kind)
  let decodedSlug = slug

  try {
    decodedSlug = decodeURIComponent(slug)
  } catch {
    // Keep the original value when the route parameter is already decoded.
  }

  const normalizedSlug = decodedSlug.normalize("NFC").toLocaleLowerCase("bg")

  return items.find(
    (item) =>
      item.slug.normalize("NFC").toLocaleLowerCase("bg") === normalizedSlug,
  )
}
