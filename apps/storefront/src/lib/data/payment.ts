"use server"

import { sdk } from "@lib/config"
import { getAuthHeaders } from "./cookies"
import { getPublicCacheOptions } from "./cache-policy"
import { HttpTypes } from "@medusajs/types"

export const listCartPaymentMethods = async (regionId: string) => {
  const authHeaders = await getAuthHeaders()
  const headers = { ...authHeaders }

  const cacheOptions = getPublicCacheOptions(
    "payment_providers",
    Boolean(authHeaders.authorization),
  )

  return sdk.client
    .fetch<HttpTypes.StorePaymentProviderListResponse>(
      `/store/payment-providers`,
      {
        method: "GET",
        query: { region_id: regionId },
        headers,
        ...cacheOptions,
      }
    )
    .then(({ payment_providers }) =>
      payment_providers.sort((a, b) => {
        return a.id > b.id ? 1 : -1
      })
    )
    .catch(() => {
      return null
    })
}
