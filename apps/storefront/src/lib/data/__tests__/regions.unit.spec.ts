import { sdk } from "@lib/config"
import React from "react"
import type { HttpTypes } from "@medusajs/types"
import { getPublicCacheOptions } from "../cache-policy"
import { getRegion } from "../regions"

jest.mock("@lib/config", () => ({ sdk: { client: { fetch: jest.fn() } } }))
jest.mock("../cache-policy", () => ({ getPublicCacheOptions: jest.fn() }))
jest.mock("react", () => {
  const path = jest.requireActual<typeof import("path")>("path")
  return jest.requireActual(
    path.join(
      path.dirname(require.resolve("react/package.json")),
      "cjs/react.react-server.development.js",
    ),
  )
})

const internals = (
  React as unknown as {
    __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: {
      A: { getCacheForType: <T>(factory: () => T) => T } | null
    }
  }
).__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE

function startRequest() {
  const resources = new Map<() => unknown, unknown>()
  internals.A = {
    getCacheForType<T>(factory: () => T): T {
      if (!resources.has(factory)) resources.set(factory, factory())
      return resources.get(factory) as T
    },
  }
}

const region = (id: string, country = "bg") =>
  ({
    id,
    countries: [{ iso_2: country }],
  }) as HttpTypes.StoreRegion

beforeEach(() => {
  jest.resetAllMocks()
  startRequest()
  jest.mocked(getPublicCacheOptions).mockReturnValue({ cache: "no-store" })
})

afterEach(() => {
  internals.A = null
})

it("deduplicates normalized region reads only within the current React server request", async () => {
  jest
    .mocked(sdk.client.fetch)
    .mockResolvedValue({ regions: [region("region_bg")] })
  await Promise.all([getRegion("BG"), getRegion("bg"), getRegion("bg")])
  expect(sdk.client.fetch).toHaveBeenCalledTimes(1)
  startRequest()
  await getRegion("bg")
  expect(sdk.client.fetch).toHaveBeenCalledTimes(2)
})

it("normalizes country codes and fetches using the invalidatable public region cache", async () => {
  jest.mocked(sdk.client.fetch).mockResolvedValue({
    regions: [region("region_bg"), region("region_ro", "ro")],
  })
  expect(await getRegion("BG")).toEqual(region("region_bg"))
  expect(getPublicCacheOptions).toHaveBeenCalledWith("regions")
  expect(sdk.client.fetch).toHaveBeenCalledWith("/store/regions", {
    method: "GET",
    query: { fields: "*countries" },
    cache: "no-store",
  })
})

it("does not retain a process-level map after the underlying cache changes", async () => {
  jest
    .mocked(sdk.client.fetch)
    .mockResolvedValueOnce({ regions: [region("old_region")] })
    .mockResolvedValueOnce({ regions: [region("new_region")] })
  expect((await getRegion("bg"))?.id).toBe("old_region")
  startRequest()
  expect((await getRegion("bg"))?.id).toBe("new_region")
})

it("retains the single-region Bulgaria fallback but does not select an unrelated region in multi-region stores", async () => {
  jest
    .mocked(sdk.client.fetch)
    .mockResolvedValueOnce({ regions: [region("only_region", "ro")] })
    .mockResolvedValueOnce({
      regions: [region("region_ro", "ro"), region("region_de", "de")],
    })
    .mockResolvedValueOnce({ regions: [] })
  expect((await getRegion("bg"))?.id).toBe("only_region")
  startRequest()
  expect(await getRegion("bg")).toBeNull()
  startRequest()
  expect(await getRegion("bg")).toBeNull()
})
