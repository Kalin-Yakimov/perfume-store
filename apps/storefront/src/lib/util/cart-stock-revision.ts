import { HttpTypes } from "@medusajs/types"

/** Every row shares a revision because bottles and decants can share stock. */
export function getCartStockRevision(cart?: HttpTypes.StoreCart) {
  return JSON.stringify([
    cart?.id,
    (cart?.items || [])
      .map((item) => [item.id, item.product_id, item.variant_id, item.quantity])
      .sort((first, second) =>
        String(first[0]).localeCompare(String(second[0])),
      ),
  ])
}
