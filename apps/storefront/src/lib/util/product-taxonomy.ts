import type { HttpTypes } from "@medusajs/types"
import type { PerfumeTaxonomyItem } from "@lib/data/perfume-taxonomies"

export function productTaxonomyProfile(
  product: Pick<HttpTypes.StoreProduct, "metadata">,
) {
  const value = product.metadata?.perfume_profile
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/** Resolve labels from stable references without rewriting persisted product data. */
export function resolveProductTaxonomy<
  T extends Pick<HttpTypes.StoreProduct, "metadata" | "title">,
>(product: T, items: PerfumeTaxonomyItem[]): T {
  const profile = productTaxonomyProfile(product)
  const designer = items.find(
    (item) => item.kind === "designer" && item.id === profile.designer_id,
  )
  const metadata = { ...product.metadata }
  let title = product.title
  if (designer) {
    const oldBrand = metadata.brand
    metadata.brand = designer.name
    if (
      typeof metadata.perfume_name === "string" &&
      metadata.perfume_name.trim()
    ) {
      title = `${designer.name} ${metadata.perfume_name}${metadata.listing_type === "decant" ? " — Отливки" : ""}`
    } else if (
      typeof oldBrand === "string" &&
      title.startsWith(`${oldBrand} `)
    ) {
      title = `${designer.name}${title.slice(oldBrand.length)}`
    }
  }
  const noteKeys = ["top_note_ids", "heart_note_ids", "base_note_ids"]
  if (noteKeys.some((key) => Array.isArray(profile[key]))) {
    const ids = noteKeys.flatMap((key) =>
      Array.isArray(profile[key]) ? (profile[key] as unknown[]) : [],
    )
    const notes = ids.map((id) =>
      items.find((item) => item.kind === "note" && item.id === id),
    )
    if (notes.every(Boolean))
      metadata.perfume_notes = Array.from(
        new Set(notes.map((note) => note!.name)),
      )
  }
  return { ...product, title, metadata }
}

export function catalogBrandOptions(
  products: HttpTypes.StoreProduct[],
  items: PerfumeTaxonomyItem[] = [],
) {
  const options = new Map<string, { value: string; label: string }>()
  for (const product of products) {
    const brand =
      product.metadata?.brand ??
      product.metadata?.designer ??
      product.collection?.title
    if (typeof brand !== "string" || !brand.trim()) continue
    const designerId = productTaxonomyProfile(product).designer_id
    const matchingDesigner = items.find(
      (item) =>
        item.kind === "designer" &&
        item.name.toLocaleLowerCase("bg") ===
          brand.trim().toLocaleLowerCase("bg"),
    )
    const value =
      typeof designerId === "string" && designerId
        ? designerId
        : matchingDesigner?.id || brand.trim()
    options.set(value, { value, label: brand.trim() })
  }
  return Array.from(options.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "bg"),
  )
}
