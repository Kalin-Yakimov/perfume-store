"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getPublicCacheOptions } from "./cache-policy"

export const retrieveCollection = async (id: string) => {
  const cacheOptions = getPublicCacheOptions("collections")

  return await sdk.client
    .fetch<{ collection: HttpTypes.StoreCollection }>(
      `/store/collections/${id}`,
      {
        ...cacheOptions,
      }
    )
    .then(({ collection }) => collection)
}

export const listCollections = async (
  queryParams: Record<string, string> = {}
): Promise<{ collections: HttpTypes.StoreCollection[]; count: number }> => {
  const cacheOptions = getPublicCacheOptions("collections")

  queryParams.limit = queryParams.limit || "100"
  queryParams.offset = queryParams.offset || "0"

  return await sdk.client
    .fetch<{ collections: HttpTypes.StoreCollection[]; count: number }>(
      "/store/collections",
      {
        query: queryParams,
        ...cacheOptions,
      }
    )
    .then(({ collections }) => ({ collections, count: collections.length }))
}

export const getCollectionByHandle = async (
  handle: string
): Promise<HttpTypes.StoreCollection | null> => {
  const cacheOptions = getPublicCacheOptions("collections")

  return await sdk.client
    .fetch<HttpTypes.StoreCollectionListResponse>(`/store/collections`, {
      query: { handle, fields: "*products" },
      ...cacheOptions,
    })
    .then(({ collections }) => collections[0] || null)
}
