import type { IProductModuleService } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"

type TaxonomyReference = { id: string; kind: string; name: string }

export async function assertTaxonomyRenameHasStableReferences(
  products: IProductModuleService,
  item: TaxonomyReference,
) {
  const take = 100
  for (let skip = 0; ; skip += take) {
    const page = await products.listProducts(
      {},
      {
        select: ["id", "metadata"],
        order: { id: "ASC" },
        take,
        skip,
      },
    )
    const legacyUsage = page.some((product) => {
      if (!usesPerfumeTaxonomy(product.metadata, item)) return false
      const value = product.metadata?.perfume_profile
      const profile =
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {}
      const keys =
        item.kind === "designer"
          ? ["designer_id"]
          : item.kind === "note"
            ? ["top_note_ids", "heart_note_ids", "base_note_ids"]
            : ["accord_ids"]
      return !keys.some((key) =>
        Object.prototype.hasOwnProperty.call(profile, key),
      )
    })
    if (legacyUsage) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Стар продукт използва този запис само по име. Първо изберете отново съответната марка, нотка или акорд в ароматния му профил и запазете, след това преименувайте записа.",
      )
    }
    if (page.length < take) return
  }
}

export function usesPerfumeTaxonomy(
  metadata: Record<string, unknown> | null | undefined,
  item: TaxonomyReference,
) {
  const value = metadata?.perfume_profile
  const profile =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  const keys =
    item.kind === "designer"
      ? ["designer_id"]
      : item.kind === "note"
        ? ["top_note_ids", "heart_note_ids", "base_note_ids"]
        : ["accord_ids"]
  if (
    keys.some((key) =>
      Array.isArray(profile[key])
        ? profile[key].includes(item.id)
        : profile[key] === item.id,
    )
  )
    return true

  // Legacy records have names only. Never let a stale copied name override IDs.
  if (keys.some((key) => Object.prototype.hasOwnProperty.call(profile, key)))
    return false
  const names =
    item.kind === "designer"
      ? ["brand", "designer"]
      : item.kind === "note"
        ? ["perfume_notes", "notes", "top_notes", "heart_notes", "base_notes"]
        : ["perfume_accords", "accords"]
  const readNames = (raw: unknown): string[] =>
    Array.isArray(raw)
      ? raw.flatMap(readNames)
      : typeof raw === "string"
        ? raw.split(/[,/|]/).map((name) => name.trim().toLocaleLowerCase("bg"))
        : []
  return names.some((key) =>
    readNames(metadata?.[key]).includes(item.name.toLocaleLowerCase("bg")),
  )
}

export async function assertPerfumeTaxonomyUnused(
  products: IProductModuleService,
  item: TaxonomyReference,
) {
  const take = 100
  for (let skip = 0; ; skip += take) {
    const page = await products.listProducts(
      {},
      {
        select: ["id", "metadata"],
        order: { id: "ASC" },
        take,
        skip,
      },
    )
    if (page.some((product) => usesPerfumeTaxonomy(product.metadata, item))) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Този запис се използва от продукт. Първо премахнете или заменете връзката в продуктите, включително скритите и черновите.",
      )
    }
    if (page.length < take) return
  }
}
