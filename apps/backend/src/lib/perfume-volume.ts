type VariantWithVolume = {
  title?: string | null
  sku?: string | null
  metadata?: Record<string, unknown> | null
}

/** The structured value is authoritative; text parsing only supports older products. */
export const readBottleVolumeMl = (variant: VariantWithVolume): number | undefined => {
  const stored = Number(variant.metadata?.volume_ml)
  if (Number.isFinite(stored) && stored > 0) return stored

  const match = `${variant.title || ""} ${variant.sku || ""}`.match(/(\d+(?:[.,]\d+)?)\s*ml/i)
  if (!match) return undefined
  const parsed = Number(match[1].replace(",", "."))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}
