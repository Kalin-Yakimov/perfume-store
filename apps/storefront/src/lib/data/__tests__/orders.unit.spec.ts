import { sdk } from "@lib/config"
import { getAuthHeaders } from "../cookies"
import { listRecentOrders, listOrdersPage } from "../orders"
import type { RecentOrder } from "../order-types"

jest.mock("@lib/config", () => ({ sdk: { client: { fetch: jest.fn() } } }))
jest.mock("../cookies", () => ({ getAuthHeaders: jest.fn() }))

beforeEach(() => jest.resetAllMocks())

it("retains the total count and reads the requested history page without caching", async () => {
  jest
    .mocked(getAuthHeaders)
    .mockResolvedValue({ authorization: "Bearer test" })
  const response = {
    orders: [{ id: "older_order" }],
    count: 11,
    offset: 10,
    limit: 10,
  }
  jest.mocked(sdk.client.fetch).mockResolvedValue(response)
  expect(await listOrdersPage(10, 10)).toEqual(response)
  expect(sdk.client.fetch).toHaveBeenCalledWith(
    "/store/orders",
    expect.objectContaining({
      query: expect.objectContaining({
        limit: 10,
        offset: 10,
        order: "-created_at",
      }),
      headers: { authorization: "Bearer test" },
      cache: "no-store",
    }),
  )
})

it("skips recent order reads when there is no customer session", async () => {
  jest.mocked(getAuthHeaders).mockResolvedValue({})
  expect(await listRecentOrders()).toEqual([])
  expect(sdk.client.fetch).not.toHaveBeenCalled()
})

it("requests the five newest orders with only the fields shown in the overview", async () => {
  const order: RecentOrder = {
    id: "order_1",
    display_id: 1,
    created_at: "2026-10-01T10:00:00.000Z",
    total: 49.99,
    currency_code: "eur",
  }
  jest
    .mocked(getAuthHeaders)
    .mockResolvedValue({ authorization: "Bearer test" })
  jest.mocked(sdk.client.fetch).mockResolvedValue({ orders: [order] })
  expect(await listRecentOrders()).toEqual([order])
  expect(sdk.client.fetch).toHaveBeenCalledWith("/store/orders", {
    method: "GET",
    query: {
      limit: 5,
      offset: 0,
      order: "-created_at",
      fields: "id,display_id,created_at,total,currency_code",
    },
    headers: { authorization: "Bearer test" },
    cache: "no-store",
  })
})

it("bounds the overview and drops relations added by Medusa's order workflow", async () => {
  const orders = Array.from({ length: 6 }, (_, index) => ({
    id: `order_${index}`,
    display_id: index,
    created_at: "2026-10-01T10:00:00.000Z",
    total: 49.99,
    currency_code: "eur",
    items: [{ id: "item_1", title: "Perfume" }],
    email: "customer@example.test",
  }))
  jest
    .mocked(getAuthHeaders)
    .mockResolvedValue({ authorization: "Bearer test" })
  jest.mocked(sdk.client.fetch).mockResolvedValue({ orders })
  const recent = await listRecentOrders()
  expect(recent).toHaveLength(5)
  expect(recent[0]).toEqual({
    id: "order_0",
    display_id: 0,
    created_at: "2026-10-01T10:00:00.000Z",
    total: 49.99,
    currency_code: "eur",
  })
})
