import React from "react"
import { sdk } from "@lib/config"
import { getAuthHeaders } from "../cookies"
import { retrieveCustomer, retrieveCustomerSummary } from "../customer-read"
import type { CustomerProfile, CustomerSummary } from "../customer-types"

jest.mock("server-only", () => ({}))
jest.mock("@lib/config", () => ({ sdk: { client: { fetch: jest.fn() } } }))
jest.mock("../cookies", () => ({ getAuthHeaders: jest.fn() }))
// The ordinary React Node build makes cache() a no-op. Exercise the installed
// server implementation with the request-local dispatcher supplied by React.
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

const summary: CustomerSummary = {
  id: "customer_1",
  email: "customer@example.test",
  first_name: "Име",
}
const profile: CustomerProfile = {
  ...summary,
  last_name: "Фамилия",
  phone: "+359888000000",
  addresses: [],
}

beforeEach(() => {
  jest.resetAllMocks()
  startRequest()
  jest.mocked(getAuthHeaders).mockResolvedValue({ authorization: "Bearer one" })
})
afterEach(() => {
  internals.A = null
})

it("skips all customer reads for a guest with empty auth headers", async () => {
  jest.mocked(getAuthHeaders).mockResolvedValue({})
  expect(await retrieveCustomerSummary()).toBeNull()
  expect(await retrieveCustomer()).toBeNull()
  expect(sdk.client.fetch).not.toHaveBeenCalled()
})

it("requests only navigation fields without addresses or orders", async () => {
  jest.mocked(sdk.client.fetch).mockResolvedValue({ customer: summary })
  expect(await retrieveCustomerSummary()).toEqual(summary)
  expect(sdk.client.fetch).toHaveBeenCalledWith("/store/customers/me", {
    method: "GET",
    query: { fields: "id,email,first_name" },
    headers: { authorization: "Bearer one" },
    cache: "no-store",
  })
})

it("retains the address book for profile and checkout without expanding orders", async () => {
  jest.mocked(sdk.client.fetch).mockResolvedValue({ customer: profile })
  expect(await retrieveCustomer()).toEqual(profile)
  expect(sdk.client.fetch).toHaveBeenCalledWith("/store/customers/me", {
    method: "GET",
    query: { fields: "id,email,first_name,last_name,phone,*addresses" },
    headers: { authorization: "Bearer one" },
    cache: "no-store",
  })
})

it("deduplicates concurrent reads of the same customer projection in one request", async () => {
  jest.mocked(sdk.client.fetch).mockResolvedValue({ customer: summary })
  const [first, second] = await Promise.all([
    retrieveCustomerSummary(),
    retrieveCustomerSummary(),
  ])
  expect(first).toBe(second)
  expect(sdk.client.fetch).toHaveBeenCalledTimes(1)
})

it("keeps the summary and address projections separate", async () => {
  jest.mocked(sdk.client.fetch).mockImplementation(async (_path, options) => ({
    customer: options?.query?.fields === "id,email,first_name" ? summary : profile,
  }))
  const [light, full] = await Promise.all([
    retrieveCustomerSummary(),
    retrieveCustomer(),
  ])
  expect(light).toEqual(summary)
  expect(full?.addresses).toEqual([])
  expect(sdk.client.fetch).toHaveBeenCalledTimes(2)
})

it("does not reuse a customer when authentication changes within a request", async () => {
  jest.mocked(sdk.client.fetch).mockResolvedValueOnce({ customer: summary })
  await retrieveCustomerSummary()
  const other = { ...summary, id: "customer_2", email: "other@example.test" }
  jest.mocked(getAuthHeaders).mockResolvedValue({ authorization: "Bearer two" })
  jest.mocked(sdk.client.fetch).mockResolvedValueOnce({ customer: other })
  expect(await retrieveCustomerSummary()).toEqual(other)
  expect(sdk.client.fetch).toHaveBeenLastCalledWith(
    "/store/customers/me",
    expect.objectContaining({ headers: { authorization: "Bearer two" } }),
  )
  expect(sdk.client.fetch).toHaveBeenCalledTimes(2)
})

it("fetches fresh customer data in the next request after a profile change", async () => {
  jest.mocked(sdk.client.fetch).mockResolvedValueOnce({ customer: summary })
  await retrieveCustomerSummary()
  startRequest()
  const updated = { ...summary, first_name: "Ново име" }
  jest.mocked(sdk.client.fetch).mockResolvedValueOnce({ customer: updated })
  expect(await retrieveCustomerSummary()).toEqual(updated)
  expect(sdk.client.fetch).toHaveBeenCalledTimes(2)
})

it("has no persistent memoization outside a React server request", async () => {
  internals.A = null
  jest.mocked(sdk.client.fetch).mockResolvedValue({ customer: summary })
  await retrieveCustomerSummary()
  await retrieveCustomerSummary()
  expect(sdk.client.fetch).toHaveBeenCalledTimes(2)
})

it("returns null on a private API failure and retries in a new request", async () => {
  jest.mocked(sdk.client.fetch).mockRejectedValueOnce(new Error("Unavailable"))
  expect(await retrieveCustomerSummary()).toBeNull()
  expect(await retrieveCustomerSummary()).toBeNull()
  expect(sdk.client.fetch).toHaveBeenCalledTimes(1)
  startRequest()
  jest.mocked(sdk.client.fetch).mockResolvedValueOnce({ customer: summary })
  expect(await retrieveCustomerSummary()).toEqual(summary)
  expect(sdk.client.fetch).toHaveBeenCalledTimes(2)
})
