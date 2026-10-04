/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react"
import { Suspense } from "react"
import { listCatalogProducts } from "@lib/data/catalog"
import { getRegion } from "@lib/data/regions"
import StoreTemplate from "../templates"
import CatalogResults from "../templates/catalog-results"
import CatalogError from "../components/catalog-error"

const refresh = jest.fn()
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }))
jest.mock("@lib/data/catalog", () => ({ listCatalogProducts: jest.fn() }))
jest.mock("@lib/data/regions", () => ({ getRegion: jest.fn() }))
jest.mock("@modules/store/components/refinement-list", () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock("../templates/paginated-products", () => ({
  __esModule: true,
  default: () => null,
}))
const props = {
  countryCode: "bg",
  perfumeFilters: { genders: [], brands: [], seasons: [], notes: [] },
}

beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(getRegion).mockResolvedValue({ id: "region_1" } as never)
})
it("puts the async catalog request inside the loading boundary", () => {
  const shell = StoreTemplate(props)
  const boundary = shell.props.children[1]
  expect(boundary.type).toBe(Suspense)
  expect(boundary.props.children.type).toBe(CatalogResults)
  expect(listCatalogProducts).not.toHaveBeenCalled()
  render(boundary.props.fallback)
  expect(screen.getByRole("status").textContent).toContain(
    "Зареждане на каталога",
  )
})
it("propagates a failed catalog read rather than rendering an empty result", async () => {
  jest
    .mocked(listCatalogProducts)
    .mockRejectedValue(new Error("temporary outage"))
  await expect(CatalogResults(props)).rejects.toThrow("temporary outage")
})
it("does not silently render a blank catalog without a region", async () => {
  jest.mocked(getRegion).mockResolvedValue(null)
  await expect(CatalogResults(props)).rejects.toThrow(
    "Catalog region is unavailable",
  )
  expect(listCatalogProducts).not.toHaveBeenCalled()
})
it("offers a server refresh and reset without exposing backend error details", () => {
  const reset = jest.fn()
  render(<CatalogError reset={reset} />)
  expect(screen.getByRole("alert").textContent).toContain(
    "Каталогът временно не е достъпен",
  )
  fireEvent.click(screen.getByRole("button", { name: "Опитай отново" }))
  expect(refresh).toHaveBeenCalledTimes(1)
  expect(reset).toHaveBeenCalledTimes(1)
})
