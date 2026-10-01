import { HttpTypes } from "@medusajs/types"

/** Bottle stock only; decants use the separate shared-volume stock check. */
export const isBottleAvailable = (product: HttpTypes.StoreProduct) =>
  (product.variants || []).some(
    (variant) =>
      !variant.manage_inventory ||
      variant.allow_backorder ||
      (variant.inventory_quantity || 0) > 0,
  )
