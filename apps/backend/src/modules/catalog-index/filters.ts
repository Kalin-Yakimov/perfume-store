import { createHash } from "node:crypto"
import type { CatalogQuery } from "../../api/store/catalog/query-schema"

export const normalizeCatalogText = (value: string) =>
  value.trim().toLocaleLowerCase("bg")
// Stable safe JSON keys: neither dots nor arbitrary user strings become paths.
export const catalogToken = (value: string) =>
  createHash("sha256").update(normalizeCatalogText(value)).digest("hex")
const contains = (value: string) => ({
  $ilike: `%${normalizeCatalogText(value).replace(/[\\%_]/g, "\\$&")}%`,
})

export function catalogFilters(
  contextKey: string,
  generation: string,
  input: CatalogQuery,
  facets = false,
) {
  const filters: Record<string, unknown> = {
    context_key: contextKey,
    generation,
  }
  const and: Record<string, unknown>[] = []
  if (input.listing_type) filters.listing_type = input.listing_type
  if (input.q)
    for (const term of input.q.split(/\s+/).filter(Boolean))
      and.push({ search_text: contains(term) })
  if (input.option_value_id?.length)
    and.push({
      $or: input.option_value_id.map((id) => ({
        traits: { options: { [catalogToken(id)]: true } },
      })),
    })
  if (!facets) {
    if (input.id?.length) filters.product_id = input.id
    if (input.collection_id?.length) filters.collection_id = input.collection_id
    if (input.category_id?.length)
      and.push({
        $or: input.category_id.map((id) => ({
          traits: { categories: { [catalogToken(id)]: true } },
        })),
      })
    for (const [values, field] of [
      [input.gender, "genders"],
      [input.season, "seasons"],
    ] as const) {
      if (values?.length)
        and.push({
          $or: values.map((value) => ({
            traits: { [field]: { [catalogToken(value)]: true } },
          })),
        })
    }
    if (input.brand?.length)
      and.push({
        $or: input.brand.map((value) => ({
          $or: [
            { traits: { brands: { [catalogToken(value)]: true } } },
            { designer_id: null, brand_text: contains(value) },
          ],
        })),
      })
    if (input.note?.length)
      and.push({
        $or: input.note.map((value) => ({
          traits: { notes: { [catalogToken(value)]: true } },
        })),
      })
    if (input.min_price !== undefined || input.max_price !== undefined)
      filters.price = {
        ...(input.min_price !== undefined ? { $gte: input.min_price } : {}),
        ...(input.max_price !== undefined ? { $lte: input.max_price } : {}),
      }
  }
  if (and.length) filters.$and = and
  return filters
}

export function catalogOrder(sort: CatalogQuery["sort"]) {
  return {
    unavailable: "ASC" as const,
    ...(sort === "created_at"
      ? { product_created_at: "DESC" as const }
      : {
          price:
            sort === "price_asc"
              ? ("ASC NULLS LAST" as const)
              : ("DESC NULLS LAST" as const),
        }),
    product_id: "ASC" as const,
  }
}
