/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react"
import { retrieveCartForRender } from "@lib/data/cart-read"
import { retrieveCustomer } from "@lib/data/customer"
import CartPage from "../../../app/[countryCode]/(main)/cart/page"
import CartError from "../../../app/[countryCode]/(main)/cart/error"

jest.mock("@lib/data/cart-read", () => ({ retrieveCartForRender: jest.fn() }))
jest.mock("@lib/data/customer", () => ({ retrieveCustomer: jest.fn() }))
jest.mock("@modules/cart/templates", () => ({
  __esModule: true,
  default: () => <p>Кошница</p>,
}))

beforeEach(() => jest.resetAllMocks())

it("passes cart loading failures to the retry screen instead of returning 404", async () => {
  jest.mocked(retrieveCartForRender).mockRejectedValue(new Error("Временна грешка"))
  await expect(CartPage()).rejects.toThrow("Временна грешка")
})

it("can render a genuinely empty cart", async () => {
  jest.mocked(retrieveCartForRender).mockResolvedValue(null)
  jest.mocked(retrieveCustomer).mockResolvedValue(null)
  render(await CartPage())
  expect(screen.getByText("Кошница")).toBeTruthy()
})

it("provides a retry without displaying raw backend errors", () => {
  const reset = jest.fn()
  render(<CartError reset={reset} />)
  expect(screen.getByText("Кошницата временно не е достъпна")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Опитай отново" }))
  expect(reset).toHaveBeenCalledTimes(1)
})
