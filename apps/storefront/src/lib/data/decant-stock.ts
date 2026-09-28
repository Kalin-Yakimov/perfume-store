"use server"

import { sdk } from "@lib/config"

import { retrieveCart } from "./cart"

type AvailabilityResponse = {
  availability: Record<string, boolean>
  max_quantity: Record<string, number>
  product_availability?: Record<string, boolean>
}

export type DecantCatalogAvailability = Record<string, boolean>

export async function getDecantAvailability(productId: string) {
  const cart = await retrieveCart(undefined, "id")
  const response = await sdk.client.fetch<AvailabilityResponse>(
    "/store/decant-stock/availability",
    {
      query: {
        product_id: productId,
        ...(cart?.id ? { cart_id: cart.id } : {}),
      },
      cache: "no-store",
    },
  )
  return response
}

export async function getDecantCatalogAvailability(productIds: string[]) {
  if (!productIds.length) return null

  try {
    const response = await sdk.client.fetch<AvailabilityResponse>(
      "/store/decant-stock/availability",
      {
        query: { product_id: productIds },
        cache: "no-store",
      },
    )
    return response.product_availability || null
  } catch {
    // Catalog rendering should still work during a temporary stock API outage.
    // Product pages perform their own authoritative availability check.
    return null
  }
}
