"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"

import { getAuthHeaders } from "./cookies"
import { getPublicCacheOptions } from "./cache-policy"

export const retrieveVariant = async (
  variant_id: string
): Promise<HttpTypes.StoreProductVariant | null> => {
  const authHeaders = await getAuthHeaders()

  const headers = {
    ...authHeaders,
  }

  const cacheOptions = getPublicCacheOptions(
    "variants",
    Boolean(authHeaders.authorization),
  )

  return await sdk.client
    .fetch<{ variant: HttpTypes.StoreProductVariant }>(
      `/store/product-variants/${variant_id}`,
      {
        method: "GET",
        query: {
          fields: "*images",
        },
        headers,
        ...cacheOptions,
      }
    )
    .then(({ variant }) => variant)
    .catch(() => null)
}
