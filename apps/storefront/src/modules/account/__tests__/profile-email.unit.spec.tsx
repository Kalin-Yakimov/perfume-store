/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react"
import { HttpTypes } from "@medusajs/types"
import ProfileEmail from "../components/profile-email"

it("shows the verified login email without a misleading edit action", () => {
  const { container } = render(
    <ProfileEmail
      customer={{ email: "verified@example.test" } as HttpTypes.StoreCustomer}
    />,
  )
  expect(screen.getByText("verified@example.test")).toBeTruthy()
  expect(screen.getByText(/Засега не може да бъде променян оттук/)).toBeTruthy()
  expect(container.querySelector("form, input, button")).toBeNull()
})
