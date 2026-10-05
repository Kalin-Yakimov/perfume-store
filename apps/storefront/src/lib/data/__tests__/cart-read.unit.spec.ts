import React from "react"
import { FetchError } from "@medusajs/js-sdk"
import { sdk } from "@lib/config"
import { getAuthHeaders, getCartId } from "../cookies"
import { DEFAULT_CART_FIELDS, retrieveCartForRender } from "../cart-read"
import { listCartOptions, retrieveCart, updateCart } from "../cart"

jest.mock("server-only", () => ({}))
jest.mock("@lib/config", () => ({
  sdk: {
    client: { fetch: jest.fn() },
    store: { cart: { update: jest.fn() } },
  },
}))
jest.mock("../cookies", () => ({
  getAuthHeaders: jest.fn(),
  getCartId: jest.fn(),
  setCartId: jest.fn(),
  removeCartId: jest.fn(),
}))
jest.mock("../regions", () => ({ getRegion: jest.fn() }))
jest.mock("../locale-actions", () => ({ getLocale: jest.fn() }))
jest.mock("../fulfillment", () => ({ listCartShippingMethods: jest.fn() }))
jest.mock("next/cache", () => ({ revalidateTag: jest.fn() }))
jest.mock("next/navigation", () => ({ redirect: jest.fn() }))
// Exercise React's installed server cache rather than the Node build's no-op.
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

const cart = { id: "cart_1", items: [], email: "before@example.test" }

beforeEach(() => {
  jest.resetAllMocks()
  startRequest()
  jest.mocked(getCartId).mockResolvedValue("cart_1")
  jest.mocked(getAuthHeaders).mockResolvedValue({ authorization: "Bearer one" })
  jest.mocked(sdk.client.fetch).mockResolvedValue({ cart })
})

afterEach(() => {
  internals.A = null
  jest.restoreAllMocks()
})

it("skips authentication and the cart API when no cart ID exists", async () => {
  jest.mocked(getCartId).mockResolvedValue(undefined)
  expect(await retrieveCartForRender()).toBeNull()
  expect(getAuthHeaders).not.toHaveBeenCalled()
  expect(sdk.client.fetch).not.toHaveBeenCalled()
})

it("deduplicates resolved cookie and explicit IDs with the same projection", async () => {
  const [first, second] = await Promise.all([
    retrieveCartForRender(),
    retrieveCartForRender("cart_1", DEFAULT_CART_FIELDS),
  ])
  expect(first).toBe(second)
  expect(sdk.client.fetch).toHaveBeenCalledTimes(1)
  expect(sdk.client.fetch).toHaveBeenCalledWith("/store/carts/cart_1", {
    method: "GET",
    query: { fields: DEFAULT_CART_FIELDS },
    headers: { authorization: "Bearer one" },
    cache: "no-store",
  })
  expect(getAuthHeaders).toHaveBeenCalledTimes(2)
})

it("deduplicates a guest cart without an authorization header", async () => {
  jest.mocked(getAuthHeaders).mockResolvedValue({})
  await Promise.all([retrieveCartForRender(), retrieveCartForRender()])
  expect(sdk.client.fetch).toHaveBeenCalledTimes(1)
  expect(sdk.client.fetch).toHaveBeenCalledWith(
    "/store/carts/cart_1",
    expect.objectContaining({ headers: {}, cache: "no-store" }),
  )
})

it("keeps different projections separate", async () => {
  await Promise.all([
    retrieveCartForRender(undefined, "id"),
    retrieveCartForRender(),
  ])
  expect(sdk.client.fetch).toHaveBeenCalledTimes(2)
  expect(sdk.client.fetch).toHaveBeenCalledWith(
    "/store/carts/cart_1",
    expect.objectContaining({ query: { fields: "id" } }),
  )
})

it("does not reuse a cart when its cookie ID changes in the same render", async () => {
  await retrieveCartForRender()
  jest.mocked(getCartId).mockResolvedValue("cart_2")
  const other = { ...cart, id: "cart_2" }
  jest.mocked(sdk.client.fetch).mockResolvedValueOnce({ cart: other })
  expect(await retrieveCartForRender()).toEqual(other)
  expect(sdk.client.fetch).toHaveBeenCalledTimes(2)
  expect(sdk.client.fetch).toHaveBeenLastCalledWith(
    "/store/carts/cart_2",
    expect.objectContaining({ cache: "no-store" }),
  )
})

it("does not reuse a cart when authorization changes in the same render", async () => {
  await retrieveCartForRender()
  jest.mocked(getAuthHeaders).mockResolvedValue({ authorization: "Bearer two" })
  await retrieveCartForRender()
  expect(sdk.client.fetch).toHaveBeenCalledTimes(2)
  expect(sdk.client.fetch).toHaveBeenLastCalledWith(
    "/store/carts/cart_1",
    expect.objectContaining({ headers: { authorization: "Bearer two" } }),
  )
})

it("fetches updated cart data in the next render", async () => {
  await retrieveCartForRender()
  startRequest()
  const updated = { ...cart, email: "after@example.test" }
  jest.mocked(sdk.client.fetch).mockResolvedValueOnce({ cart: updated })
  expect(await retrieveCartForRender()).toEqual(updated)
  expect(sdk.client.fetch).toHaveBeenCalledTimes(2)
})

it("has no persistent memoization outside a React server render", async () => {
  internals.A = null
  await retrieveCartForRender()
  await retrieveCartForRender()
  expect(sdk.client.fetch).toHaveBeenCalledTimes(2)
})

it("preserves the distinction between a missing cart and a server outage", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {})
  jest
    .mocked(sdk.client.fetch)
    .mockRejectedValueOnce(new FetchError("Missing", "Not found", 404))
  expect(await retrieveCartForRender()).toBeNull()
  expect(await retrieveCartForRender()).toBeNull()
  expect(sdk.client.fetch).toHaveBeenCalledTimes(1)
  startRequest()
  jest
    .mocked(sdk.client.fetch)
    .mockRejectedValueOnce(new FetchError("Down", "Server error", 503))
  await expect(retrieveCartForRender()).rejects.toThrow(
    "Заявката не можа да бъде изпълнена",
  )
})

it("keeps action reads fresh after a mutation even with an active render cache", async () => {
  await retrieveCartForRender()
  await retrieveCart()
  const updated = { ...cart, email: "after@example.test" }
  jest.mocked(sdk.store.cart.update).mockResolvedValueOnce({
    cart: updated,
  } as unknown as Awaited<ReturnType<typeof sdk.store.cart.update>>)
  await updateCart({ email: updated.email })
  jest.mocked(sdk.client.fetch).mockResolvedValueOnce({ cart: updated })
  expect(await retrieveCart()).toEqual(updated)
  expect(sdk.client.fetch).toHaveBeenCalledTimes(3)
})

it("uses an explicit shipping-options cart ID without rereading cookies", async () => {
  jest.mocked(sdk.client.fetch).mockResolvedValueOnce({ shipping_options: [] })
  expect(await listCartOptions("cart_known")).toEqual({ shipping_options: [] })
  expect(getCartId).not.toHaveBeenCalled()
  expect(sdk.client.fetch).toHaveBeenCalledWith("/store/shipping-options", {
    query: { cart_id: "cart_known" },
    headers: { authorization: "Bearer one" },
    cache: "no-store",
  })
})

it("retains the no-argument shipping-options cookie fallback", async () => {
  jest.mocked(sdk.client.fetch).mockResolvedValueOnce({ shipping_options: [] })
  await listCartOptions()
  expect(getCartId).toHaveBeenCalledTimes(1)
  expect(sdk.client.fetch).toHaveBeenCalledWith(
    "/store/shipping-options",
    expect.objectContaining({ query: { cart_id: "cart_1" }, cache: "no-store" }),
  )
})
