import "server-only"

import { cache } from "react"
import { sdk } from "@lib/config"
import medusaError, { getMedusaErrorStatus } from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { getAuthHeaders, getCartId } from "./cookies"

export const DEFAULT_CART_FIELDS =
  "*items, *region, *items.product, *items.variant, *items.thumbnail, *items.metadata, +items.total, *promotions, +shipping_methods.name, +metadata"

/** Fetches fresh data for mutation workflows, even during a server render. */
export async function readCart(
  id: string,
  fields: string,
  authorization?: string,
): Promise<HttpTypes.StoreCart | null> {
  return sdk.client
    .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${id}`, {
      method: "GET",
      query: { fields },
      headers: authorization ? { authorization } : {},
      // Carts contain private customer records and prices. React memoization
      // must never turn into persistent Next.js data caching.
      cache: "no-store",
    })
    .then(({ cart }) => cart)
    .catch((error) => {
      if (getMedusaErrorStatus(error) === 404) return null
      return medusaError(error)
    })
}

// React owns this cache for one render. Resolve cookies outside it and use
// primitive keys so only the same cart, projection, and session share a read.
const readCartForRender = cache(readCart)

/** Read-only render path; mutation workflows use retrieveCart() in cart.ts. */
export async function retrieveCartForRender(cartId?: string, fields?: string) {
  const id = cartId || (await getCartId())
  if (!id) return null

  const { authorization } = await getAuthHeaders()
  return readCartForRender(id, fields ?? DEFAULT_CART_FIELDS, authorization)
}
