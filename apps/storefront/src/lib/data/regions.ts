"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getPublicCacheOptions, PUBLIC_CACHE_TTL } from "./cache-policy"

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

const regionMap = new Map<string, HttpTypes.StoreRegion>()
let regionMapUpdatedAt = 0

export const getRegion = async (countryCode: string) => {
  if (
    process.env.NODE_ENV === "development" ||
    Date.now() - regionMapUpdatedAt > PUBLIC_CACHE_TTL.regions * 1000
  ) {
    regionMap.clear()
  }

  if (regionMap.has(countryCode)) {
    return regionMap.get(countryCode)
  }

  const regions = await listRegions()

  if (!regions) {
    return null
  }

  regions.forEach((region) => {
    region.countries?.forEach((c) => {
      const countryCode = c?.iso_2?.toLowerCase()
      if (countryCode) {
        regionMap.set(countryCode, region)
      }
    })
  })
  regionMapUpdatedAt = Date.now()

  const region = countryCode
    ? regionMap.get(countryCode.toLowerCase())
    : regionMap.get("us")

  // This project currently operates in a single Medusa region. If a locale
  // route is missing from a region's country list, keep the storefront usable
  // instead of returning a blank catalog.
  return region ?? (regions.length === 1 ? regions[0] : null)
}
