"use server"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

export const listRegions = async () => {
  const isDevelopment = process.env.NODE_ENV === "development"
  const next = isDevelopment ? {} : await getCacheOptions("regions")

  return await sdk.client
    .fetch<{ regions: HttpTypes.StoreRegion[] }>(`/store/regions`, {
      method: "GET",
      query: { fields: "*countries" },
      next,
      cache: isDevelopment ? "no-store" : "force-cache",
    })
    .then(({ regions }) => regions)
}

export const retrieveRegion = async (id: string) => {
  const next = {
    ...(await getCacheOptions(["regions", id].join("-"))),
  }

  return await sdk.client
    .fetch<{ region: HttpTypes.StoreRegion }>(`/store/regions/${id}`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    .then(({ region }) => region)
}

const regionMap = new Map<string, HttpTypes.StoreRegion>()

export const getRegion = async (countryCode: string) => {
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

  const region = countryCode
    ? regionMap.get(countryCode.toLowerCase())
    : regionMap.get("us")

  // This project currently operates in a single Medusa region. If a locale
  // route is missing from a region's country list, keep the storefront usable
  // instead of returning a blank catalog.
  return region ?? (regions.length === 1 ? regions[0] : null)
}
