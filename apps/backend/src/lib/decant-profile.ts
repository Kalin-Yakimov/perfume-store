export const sourceMetadataForDecant = (metadata: Record<string, unknown> | null) => ({
  brand: metadata?.brand || null,
  gender: metadata?.gender || null,
  seasons: metadata?.seasons || [],
  perfume_notes: metadata?.perfume_notes || [],
  perfume_accords: metadata?.perfume_accords || [],
  perfume_profile: metadata?.perfume_profile || null,
})
