import { FetchError } from "@medusajs/js-sdk"
import { sdk } from "@lib/config"
import { getAuthHeaders, getCartId, setCartId } from "../cookies"
import { getRegion } from "../regions"
import {
  getCartLineItemQuantityLimit,
  getOrSetCart,
  retrieveCart,
  updateLineItem,
} from "../cart"

jest.mock("@lib/config", () => ({
  sdk: {
    client: { fetch: jest.fn() },
    store: {
      cart: { create: jest.fn(), update: jest.fn(), updateLineItem: jest.fn() },
    },
  },
}))
jest.mock("../cookies", () => ({
  getAuthHeaders: jest.fn(async () => ({})),
  getCartId: jest.fn(),
  setCartId: jest.fn(),
  removeCartId: jest.fn(),
}))
jest.mock("../regions", () => ({ getRegion: jest.fn() }))
jest.mock("../locale-actions", () => ({ getLocale: jest.fn() }))
jest.mock("../fulfillment", () => ({ listCartShippingMethods: jest.fn() }))
jest.mock("next/cache", () => ({ revalidateTag: jest.fn() }))
jest.mock("next/navigation", () => ({ redirect: jest.fn() }))

describe("cart stock and errors", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest
      .mocked(getAuthHeaders)
      .mockResolvedValue({ authorization: "Bearer test" })
    jest.mocked(getCartId).mockResolvedValue("cart_1")
    jest.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it("finds the permitted bottle quantity after an SDK 409 in a mixed cart", async () => {
    jest.mocked(sdk.client.fetch).mockImplementation(async (path, args) => {
      if (String(path).includes("/store/carts/"))
        return {
          cart: {
            id: "cart_1",
            items: [
              {
                id: "line_1",
                product_id: "bottle",
                variant_id: "bottle_variant",
                quantity: 1,
              },
              {
                id: "line_2",
                product_id: "decant",
                variant_id: "decant_variant",
                quantity: 1,
              },
            ],
          },
        }
      if (String(path).includes("/store/products/"))
        return {
          product: {
            variants: [
              {
                id: "bottle_variant",
                manage_inventory: true,
                inventory_quantity: 3,
              },
            ],
          },
        }
      const quantity = (args?.body as { quantity: number }).quantity
      if (quantity > 2) throw new FetchError("Няма наличност", "Conflict", 409)
      return { valid: true }
    })
    expect(await getCartLineItemQuantityLimit("line_1")).toBe(2)
    expect(sdk.client.fetch).toHaveBeenCalledWith(
      "/store/decant-stock/validate",
      expect.objectContaining({
        body: { cart_id: "cart_1", line_item_id: "line_1", quantity: 2 },
      }),
    )
  })

  it("does not treat a server outage as lack of stock", async () => {
    jest
      .mocked(sdk.client.fetch)
      .mockResolvedValueOnce({
        cart: {
          id: "cart_1",
          items: [
            {
              id: "line_1",
              product_id: "bottle",
              variant_id: "variant_1",
              quantity: 1,
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        product: {
          variants: [
            { id: "variant_1", manage_inventory: true, inventory_quantity: 3 },
          ],
        },
      })
      .mockRejectedValueOnce(
        new FetchError("Server unavailable", "Server error", 503),
      )
    await expect(getCartLineItemQuantityLimit("line_1")).rejects.toMatchObject({
      status: 503,
    })
  })

  it("only treats a missing cart as null", async () => {
    jest
      .mocked(sdk.client.fetch)
      .mockRejectedValueOnce(new FetchError("Missing", "Not found", 404))
    expect(await retrieveCart()).toBeNull()
    jest
      .mocked(sdk.client.fetch)
      .mockRejectedValueOnce(new FetchError("Down", "Server error", 503))
    await expect(retrieveCart()).rejects.toThrow(
      "Заявката не можа да бъде изпълнена",
    )
  })

  it("does not replace an existing cart when the backend is temporarily down", async () => {
    jest
      .mocked(getRegion)
      .mockResolvedValue({ id: "region_1" } as Awaited<
        ReturnType<typeof getRegion>
      >)
    jest
      .mocked(sdk.client.fetch)
      .mockRejectedValueOnce(new FetchError("Down", "Server error", 503))
    await expect(getOrSetCart("bg")).rejects.toThrow()
    expect(sdk.store.cart.create).not.toHaveBeenCalled()
    expect(setCartId).not.toHaveBeenCalled()
  })

  it("surfaces stock rejection without updating the line item", async () => {
    jest
      .mocked(sdk.client.fetch)
      .mockRejectedValueOnce(
        new FetchError("Няма достатъчна наличност", "Conflict", 409),
      )
    await expect(
      updateLineItem({ lineId: "line_1", quantity: 3 }),
    ).rejects.toThrow("Няма достатъчна наличност")
    expect(sdk.store.cart.updateLineItem).not.toHaveBeenCalled()
  })
})
