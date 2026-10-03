"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { cache } from "react"
import { getPublicCacheOptions } from "./cache-policy"

export const listRegions = async () => {
  const cacheOptions = getPublicCacheOptions("regions")

  return await sdk.client
    .fetch<{ regions: HttpTypes.StoreRegion[] }>(`/store/regions`, {
      method: "GET",
      query: { fields: "*countries" },
      ...cacheOptions,
    })
    .then(({ regions }) => regions)
}

export const retrieveRegion = async (id: string) => {
  const cacheOptions = getPublicCacheOptions("regions")

  return await sdk.client
    .fetch<{ region: HttpTypes.StoreRegion }>(`/store/regions/${id}`, {
      method: "GET",
      ...cacheOptions,
    })
    .then(({ region }) => region)
}

// Request-local memoization only. A process-level map would bypass the public
// `regions` tag after an admin update until its independent TTL expired.
const getRegionForRequest = cache(async (countryCode: string) => {
  const regions = await listRegions()

  if (!regions) {
    return null
  }

  const normalizedCountryCode = countryCode.toLowerCase() || "bg"
  const region = regions.find((candidate) =>
    candidate.countries?.some(
      (country) => country.iso_2?.toLowerCase() === normalizedCountryCode,
    ),
  )

  // This project currently operates in a single Medusa region. If a locale
  // route is missing from a region's country list, keep the storefront usable
  // instead of returning a blank catalog.
  return region ?? (regions.length === 1 ? regions[0] : null)
})

export const getRegion = async (countryCode: string) =>
  getRegionForRequest(countryCode.toLowerCase())
