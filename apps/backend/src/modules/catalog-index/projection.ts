import type { HttpTypes } from "@medusajs/framework/types"
import type { CatalogEntryInput } from "./service"
import { catalogToken, normalizeCatalogText } from "./filters"

export type CatalogTaxonomy = { id: string; kind: string; name: string }
export type CatalogProduct = Omit<
  HttpTypes.StoreProduct,
  "categories" | "variants"
> & {
  categories?:
    | (HttpTypes.StoreProductCategory & {
        is_active: boolean
        is_internal: boolean
      })[]
    | null
  variants:
    | (Omit<HttpTypes.StoreProductVariant, "manage_inventory"> & {
        manage_inventory: boolean
      })[]
    | null
}
const values = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap(values)
    : typeof value === "string"
      ? value.split(/[,/|]/).map(normalizeCatalogText).filter(Boolean)
      : []
const tokens = (values: string[]) =>
  Object.fromEntries(values.map((value) => [catalogToken(value), true]))

export function projectCatalogProduct(
  product: CatalogProduct,
  taxonomies: CatalogTaxonomy[],
  contextKey: string,
  generation: string,
  unavailable: boolean,
): CatalogEntryInput {
  const metadata = product.metadata || {}
  const rawProfile = metadata.perfume_profile
  const profile =
    rawProfile && typeof rawProfile === "object" && !Array.isArray(rawProfile)
      ? (rawProfile as Record<string, unknown>)
      : {}
  const tags = (product.tags || []).flatMap((tag) => values(tag.value))
  const fieldValues = (keys: string[]) => [
    ...keys.flatMap((key) => values(metadata[key])),
    ...tags,
  ]
  const designerId =
    typeof profile.designer_id === "string" && profile.designer_id
      ? profile.designer_id
      : null
  const designer = taxonomies.find(
    (item) => item.kind === "designer" && item.id === designerId,
  )
  const brand =
    designer?.name ||
    metadata.brand ||
    metadata.designer ||
    product.collection?.title
  const brandLabel =
    typeof brand === "string" && brand.trim() ? brand.trim() : null
  const matchingDesigner = taxonomies.find(
    (item) =>
      item.kind === "designer" &&
      normalizeCatalogText(item.name) ===
        normalizeCatalogText(brandLabel || ""),
  )
  const brandText = [
    ...fieldValues(["brand", "designer"]),
    ...values(product.collection?.title),
    product.title,
    designer?.name || "",
  ].join(" | ")
  const noteKeys = ["top_note_ids", "heart_note_ids", "base_note_ids"]
  const hasNoteReferences = noteKeys.some((key) =>
    Object.prototype.hasOwnProperty.call(profile, key),
  )
  const noteIds = noteKeys.flatMap((key) =>
    Array.isArray(profile[key])
      ? (profile[key] as unknown[]).filter(
          (id): id is string => typeof id === "string",
        )
      : [],
  )
  // Preserve the original starter fixture before seed-perfume-taxonomies has
  // persisted its note references. Real products always use stored metadata.
  const demoNotes =
    product.handle === "demo-perfume-01"
      ? [
          "Ананас",
          "Бергамот",
          "Ябълка",
          "Жасмин",
          "Бреза",
          "Амбров акорд",
          "Дъбов мъх",
          "Мускус",
          "Сандалово дърво",
        ].map(normalizeCatalogText)
      : []
  const legacyNotes = [
    ...fieldValues([
      "notes",
      "perfume_notes",
      "top_notes",
      "heart_notes",
      "base_notes",
    ]),
    ...demoNotes,
  ]
  const brands = designerId
    ? [designerId, ...(designer ? [designer.name] : [])]
    : taxonomies
        .filter(
          (item) =>
            item.kind === "designer" &&
            normalizeCatalogText(brandText).includes(
              normalizeCatalogText(item.name),
            ),
        )
        .flatMap((item) => [item.id, item.name])
  const notes = hasNoteReferences
    ? [
        ...noteIds,
        ...taxonomies
          .filter((item) => item.kind === "note" && noteIds.includes(item.id))
          .map((item) => item.name),
      ]
    : [
        ...legacyNotes,
        ...taxonomies
          .filter(
            (item) =>
              item.kind === "note" &&
              legacyNotes.includes(normalizeCatalogText(item.name)),
          )
          .map((item) => item.id),
      ]
  const variants = product.variants || []
  const prices = variants
    .map((variant) => variant.calculated_price?.calculated_amount)
    .filter(
      (price): price is number =>
        typeof price === "number" && Number.isFinite(price),
    )
  return {
    context_key: contextKey,
    generation,
    product_id: product.id,
    listing_type:
      metadata.listing_type === "decant" ? "decant" : "full_perfume",
    product_created_at: new Date(product.created_at!),
    price: prices.length ? Math.min(...prices) : null,
    unavailable,
    search_text: normalizeCatalogText(
      [
        product.title,
        product.subtitle,
        product.handle,
        brandLabel,
        ...variants.flatMap((variant) => [variant.title, variant.sku]),
      ]
        .filter(Boolean)
        .join(" "),
    ),
    gender_text: fieldValues(["gender", "sex"]).join(" | "),
    season_text: fieldValues(["season", "seasons"]).join(" | "),
    brand_text: normalizeCatalogText(brandText),
    legacy_note_text: hasNoteReferences ? "" : legacyNotes.join(" | "),
    designer_id: designerId,
    collection_id: product.collection_id || null,
    traits: {
      brands: tokens(brands),
      notes: tokens(notes),
      genders: tokens(fieldValues(["gender", "sex"])),
      seasons: tokens(fieldValues(["season", "seasons"])),
      options: tokens(
        variants.flatMap((variant) =>
          (variant.options || []).map((option) => option.id),
        ),
      ),
      categories: tokens(
        (product.categories || [])
          .filter((category) => category.is_active && !category.is_internal)
          .map((category) => category.id),
      ),
    },
    brand_value: brandLabel
      ? designerId || matchingDesigner?.id || brandLabel
      : null,
    brand_label: brandLabel,
  }
}
