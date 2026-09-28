export const perfumeFields = [
  "id",
  "title",
  "handle",
  "status",
  "thumbnail",
  "description",
  "metadata",
  "variants.id",
  "variants.title",
  "variants.sku",
  "variants.metadata",
  "variants.prices.amount",
  "variants.prices.currency_code",
  "variants.inventory_items.inventory_item_id",
  "variants.inventory_items.inventory.location_levels.stocked_quantity",
  "variants.inventory_items.inventory.location_levels.reserved_quantity",
]

export const isFullPerfume = (metadata: Record<string, unknown> | null | undefined) =>
  metadata?.listing_type === "full_perfume" ||
  (metadata?.listing_type !== "decant" &&
    (typeof metadata?.brand === "string" ||
      (typeof metadata?.perfume_profile === "object" && metadata.perfume_profile !== null)))
