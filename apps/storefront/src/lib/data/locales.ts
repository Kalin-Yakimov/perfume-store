"use server"

import { sdk } from "@lib/config"
import { getPublicCacheOptions } from "./cache-policy"

export type Locale = {
  code: string
  name: string
}

/**
 * Fetches available locales from the backend.
 * Returns null if the endpoint returns 404 (locales not configured).
 */
export const listLocales = async (): Promise<Locale[] | null> => {
  const cacheOptions = getPublicCacheOptions("locales")

  return sdk.client
    .fetch<{ locales: Locale[] }>(`/store/locales`, {
      method: "GET",
      ...cacheOptions,
    })
    .then(({ locales }) => locales)
    .catch(() => null)
}
