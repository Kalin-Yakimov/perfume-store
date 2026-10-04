import type { HttpTypes } from "@medusajs/types"

// The same public contract is applied by Medusa's catalog projection. Fail
// closed for an unconfigured decant; ordinary bottle variants are unchanged.
export function getCustomerVariants<T extends { id: string }>(product: {
  metadata?: Record<string, unknown> | null
  variants?: T[] | null
}): T[] {
  const variants = product.variants || []
  if (product.metadata?.listing_type !== "decant") return variants
  if (product.metadata.decant_enabled === false) return []
  const ids = product.metadata.decant_enabled_variant_ids
  if (!Array.isArray(ids)) return []
  const enabled = new Set(
    ids.filter((id): id is string => typeof id === "string"),
  )
  return variants.filter((variant) => enabled.has(variant.id))
}

export function getCheapestCustomerVariant(product: HttpTypes.StoreProduct) {
  return getCustomerVariants(product)
    .filter((variant) => {
      const amount = variant.calculated_price?.calculated_amount
      return typeof amount === "number" && Number.isFinite(amount)
    })
    .sort(
      (a, b) =>
        a.calculated_price!.calculated_amount! -
        b.calculated_price!.calculated_amount!,
    )[0]
}

export function getVariantVolumeLabel(
  product: { metadata?: Record<string, unknown> | null },
  variant?: HttpTypes.StoreProductVariant,
) {
  if (!variant) return ""
  const volumes = product.metadata?.decant_variant_volumes
  const mapped =
    volumes && typeof volumes === "object" && !Array.isArray(volumes)
      ? (volumes as Record<string, unknown>)[variant.id]
      : undefined
  const stored = Number(mapped ?? variant.metadata?.volume_ml)
  if (Number.isFinite(stored) && stored > 0) return `${stored} мл`
  const options = variant.options?.map((option) => option.value).join(" ") || ""
  const match = `${variant.title || ""} ${options}`.match(
    /(\d+(?:[.,]\d+)?)\s*(?:ml|мл)/i,
  )
  return match ? `${match[1]} мл` : ""
}
