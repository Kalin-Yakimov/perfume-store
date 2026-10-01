/** @jest-environment jsdom */

import { act, fireEvent, render, screen } from "@testing-library/react"
import { HttpTypes } from "@medusajs/types"
import { deleteCustomerAddress } from "@lib/data/customer"
import EditAddress from "../components/address-card/edit-address-modal"

jest.mock("@lib/data/customer", () => ({
  deleteCustomerAddress: jest.fn(),
  updateCustomerAddress: jest.fn(),
}))
jest.mock("@modules/checkout/components/country-select", () => ({
  __esModule: true,
  default: () => null,
}))

it("keeps the address visible, reports failed deletion and allows retry", async () => {
  let complete!: (
    value: Awaited<ReturnType<typeof deleteCustomerAddress>>,
  ) => void
  jest.mocked(deleteCustomerAddress).mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve
    }),
  )
  render(
    <EditAddress
      region={{ countries: [] } as unknown as HttpTypes.StoreRegion}
      address={
        {
          id: "address_1",
          first_name: "Име",
          address_1: "Тестов адрес",
        } as HttpTypes.StoreCustomerAddress
      }
    />,
  )
  const remove = screen.getByTestId(
    "address-delete-button",
  ) as HTMLButtonElement
  fireEvent.click(remove)
  expect(remove.disabled).toBe(true)
  fireEvent.click(remove)
  expect(deleteCustomerAddress).toHaveBeenCalledTimes(1)
  await act(async () => {
    complete({ success: false, error: "Адресът не можа да бъде изтрит." })
  })
  expect(screen.getByRole("alert").textContent).toBe(
    "Адресът не можа да бъде изтрит.",
  )
  expect(screen.getByText("Тестов адрес")).toBeTruthy()
  expect(remove.disabled).toBe(false)
})
