// Keep this public variant contract aligned with the storefront helper. Internal
// disabled variants must not affect advertised prices, volumes or price filters.
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
