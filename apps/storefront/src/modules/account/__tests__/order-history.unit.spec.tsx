/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react"
import Orders from "../../../app/[countryCode]/(main)/account/@dashboard/orders/page"
import { listOrdersPage } from "@lib/data/orders"
import { retrieveCustomerSummary } from "@lib/data/customer-read"
import { redirect } from "next/navigation"

jest.mock("@lib/data/orders", () => ({ listOrdersPage: jest.fn() }))
jest.mock("@lib/data/customer-read", () => ({
  retrieveCustomerSummary: jest.fn(),
}))
jest.mock("next/navigation", () => ({
  redirect: jest.fn(() => {
    throw new Error("redirect")
  }),
}))
jest.mock("@modules/account/components/order-overview", () => ({
  __esModule: true,
  default: ({ orders }: { orders: { id: string }[] }) => (
    <div>
      {orders.map((order) => (
        <p key={order.id}>{order.id}</p>
      ))}
    </div>
  ),
}))
jest.mock("@modules/store/components/pagination", () => ({
  Pagination: ({ page, totalPages }: { page: number; totalPages: number }) => (
    <p>
      Страница {page} от {totalPages}
    </p>
  ),
}))
jest.mock("@modules/account/components/transfer-request-form", () => ({
  __esModule: true,
  default: () => null,
}))
beforeEach(() => {
  jest.resetAllMocks()
  jest
    .mocked(retrieveCustomerSummary)
    .mockResolvedValue({ id: "customer_1" } as never)
})
it("shows an older order on page two and keeps the total number of pages", async () => {
  jest
    .mocked(listOrdersPage)
    .mockResolvedValue({
      orders: [{ id: "older_order" }],
      count: 11,
      offset: 10,
      limit: 10,
    } as never)
  render(await Orders({ searchParams: Promise.resolve({ page: "2" }) }))
  expect(listOrdersPage).toHaveBeenCalledWith(10, 10)
  expect(screen.getByText("older_order")).toBeTruthy()
  expect(screen.getByText("Страница 2 от 2")).toBeTruthy()
})
it("redirects an out of range page to the last real page", async () => {
  jest.mocked(redirect).mockImplementation(() => {
    throw new Error("redirect")
  })
  jest
    .mocked(listOrdersPage)
    .mockResolvedValue({
      orders: [],
      count: 11,
      offset: 20,
      limit: 10,
    } as never)
  await expect(
    Orders({ searchParams: Promise.resolve({ page: "3" }) }),
  ).rejects.toThrow("redirect")
  expect(redirect).toHaveBeenCalledWith("/vhod/porachki?page=2")
})
it("does not read private order data without a customer", async () => {
  jest.mocked(retrieveCustomerSummary).mockResolvedValue(null)
  expect(await Orders({ searchParams: Promise.resolve({}) })).toBeNull()
  expect(listOrdersPage).not.toHaveBeenCalled()
})
