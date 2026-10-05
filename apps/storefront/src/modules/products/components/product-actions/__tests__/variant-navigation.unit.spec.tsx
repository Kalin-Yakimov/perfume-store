/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { HttpTypes } from "@medusajs/types"
import { getDecantAvailability } from "@lib/data/decant-stock"
import ProductActions from ".."

const replace = jest.fn()
const refresh = jest.fn()
let searchParams = new URLSearchParams()
let pathname = "/products/perfume"

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  usePathname: () => pathname,
  useSearchParams: () => searchParams,
  useParams: () => ({ countryCode: "bg" }),
}))
jest.mock("@lib/data/cart", () => ({ addToCart: jest.fn() }))
jest.mock("@lib/data/decant-stock", () => ({ getDecantAvailability: jest.fn() }))
jest.mock("@lib/hooks/use-in-view", () => ({ useIntersection: () => true }))
jest.mock("@modules/common/components/ui", () => ({
  Button: ({
    children,
    disabled,
    onClick,
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button disabled={disabled} onClick={onClick}>{children}</button>
  ),
}))
jest.mock("@modules/common/components/divider", () => ({
  __esModule: true,
  default: () => <hr />,
}))
jest.mock("../../product-price", () => ({
  __esModule: true,
  default: ({ variant }: { variant?: HttpTypes.StoreProductVariant }) => (
    <output data-testid="selected-variant">{variant?.id || "none"}</output>
  ),
}))
jest.mock("../mobile-actions", () => ({ __esModule: true, default: () => null }))

const region = { id: "region_bg" } as HttpTypes.StoreRegion
const product = (
  listingType: "decant" | "full_perfume" = "decant",
  volumes = [10, 5],
  id = "perfume",
) => ({
  id,
  title: "Perfume",
  metadata: {
    listing_type: listingType,
    decant_enabled_variant_ids: volumes.map((volume) => `${id}_${volume}`),
  },
  options: [{
    id: "volume",
    title: "Volume",
    values: volumes.map((volume) => ({ value: `${volume} ml` })),
  }],
  variants: volumes.map((volume) => ({
    id: `${id}_${volume}`,
    title: `${volume} ml`,
    manage_inventory: false,
    metadata: { volume_ml: volume },
    options: [{ option_id: "volume", value: `${volume} ml` }],
  })),
}) as unknown as HttpTypes.StoreProduct

async function expectSelected(id: string) {
  await waitFor(() => {
    expect(screen.getByTestId("selected-variant").textContent).toBe(id)
  })
}

beforeEach(() => {
  jest.resetAllMocks()
  pathname = "/products/perfume"
  searchParams = new URLSearchParams()
  jest.mocked(getDecantAvailability).mockResolvedValue({
    availability: { perfume_5: true, perfume_10: true, next_2: true, next_20: true },
    max_quantity: { perfume_5: 5, perfume_10: 5, next_2: 5, next_20: 5 },
  })
})

it("selects the smallest decant locally without another page request", async () => {
  render(<ProductActions product={product()} region={region} />)
  await expectSelected("perfume_5")
  expect(replace).not.toHaveBeenCalled()
})

it("selects a single bottle variant without rewriting the URL", async () => {
  render(<ProductActions product={product("full_perfume", [50])} region={region} />)
  await expectSelected("perfume_50")
  expect(replace).not.toHaveBeenCalled()
})

it.each(["decant", "full_perfume"] as const)(
  "honors an explicit v_id for a %s without navigating",
  async (listingType) => {
    searchParams = new URLSearchParams("v_id=perfume_10")
    render(<ProductActions product={product(listingType)} region={region} />)
    await expectSelected("perfume_10")
    expect(replace).not.toHaveBeenCalled()
  },
)

it("updates the variant URL and preserves other parameters after an option click", async () => {
  searchParams = new URLSearchParams("campaign=test")
  render(<ProductActions product={product()} region={region} />)
  await expectSelected("perfume_5")

  fireEvent.click(screen.getByRole("button", { name: "10 мл" }))
  await expectSelected("perfume_10")
  expect(replace).toHaveBeenCalledTimes(1)
  expect(replace).toHaveBeenCalledWith(
    "/products/perfume?campaign=test&v_id=perfume_10",
    { scroll: false },
  )
})

it("restores URL selections during history navigation without replacing them", async () => {
  const currentProduct = product()
  searchParams = new URLSearchParams("v_id=perfume_10")
  const view = render(<ProductActions product={currentProduct} region={region} />)
  await expectSelected("perfume_10")

  searchParams = new URLSearchParams("v_id=perfume_5")
  view.rerender(<ProductActions product={currentProduct} region={region} />)
  await expectSelected("perfume_5")

  searchParams = new URLSearchParams()
  view.rerender(<ProductActions product={currentProduct} region={region} />)
  await expectSelected("perfume_5")
  expect(replace).not.toHaveBeenCalled()
})

it("resets automatic defaults when the product changes", async () => {
  const view = render(<ProductActions product={product()} region={region} />)
  await expectSelected("perfume_5")

  pathname = "/products/next"
  view.rerender(<ProductActions product={product("decant", [20, 2], "next")} region={region} />)
  await expectSelected("next_2")
  expect(replace).not.toHaveBeenCalled()
})

it("keeps partially selected options when a user selection removes v_id", async () => {
  const currentProduct = product("full_perfume", [50, 100])
  currentProduct.options!.push({
    id: "format",
    title: "Format",
    values: [{ value: "spray" }, { value: "refill" }],
  } as HttpTypes.StoreProductOption)
  currentProduct.variants!.forEach((variant, index) => {
    variant.options!.push({
      option_id: "format",
      value: index === 0 ? "spray" : "refill",
    } as HttpTypes.StoreProductOptionValue)
  })
  searchParams = new URLSearchParams("v_id=perfume_50")
  const view = render(<ProductActions product={currentProduct} region={region} />)
  await expectSelected("perfume_50")

  fireEvent.click(screen.getByRole("button", { name: "100 мл" }))
  await expectSelected("none")
  expect(replace).toHaveBeenLastCalledWith("/products/perfume", { scroll: false })

  searchParams = new URLSearchParams()
  view.rerender(<ProductActions product={currentProduct} region={region} />)
  fireEvent.click(screen.getByRole("button", { name: "refill" }))
  await expectSelected("perfume_100")
  expect(replace).toHaveBeenLastCalledWith(
    "/products/perfume?v_id=perfume_100",
    { scroll: false },
  )
})
