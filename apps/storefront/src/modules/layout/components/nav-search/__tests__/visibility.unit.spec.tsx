/** @jest-environment jsdom */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { sdk } from "@lib/config"
import { getDecantCatalogAvailability } from "@lib/data/decant-stock"
import NavSearch from ".."

jest.mock("@lib/config", () => ({
  sdk: { store: { product: { list: jest.fn() } } },
}))
jest.mock("@lib/data/regions", () => ({
  getRegion: jest.fn(async () => ({ id: "region_1" })),
}))
jest.mock("@lib/data/decant-stock", () => ({
  getDecantCatalogAvailability: jest.fn(async () => ({})),
}))
jest.mock("@lib/data/perfume-taxonomies", () => ({
  listPerfumeTaxonomies: jest.fn(async () => []),
}))
jest.mock("next/navigation", () => ({
  useParams: () => ({ countryCode: "bg" }),
  useRouter: () => ({ push: jest.fn() }),
}))
jest.mock("@modules/common/components/localized-client-link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

it("filters hidden and non-opted-in products before choosing the six visible results or checking stock", async () => {
  jest.useFakeTimers()
  const hidden = Array.from({ length: 8 }, (_, i) => ({
    id: `hidden_${i}`,
    title: `Hidden ${i}`,
    handle: `hidden-${i}`,
    metadata: { catalog_visible: false, listing_type: "decant" },
    variants: [],
  }))
  jest.mocked(sdk.store.product.list).mockResolvedValue({
    products: [
      ...hidden,
      {
        id: "private",
        title: "Private",
        handle: "private",
        metadata: {},
        variants: [],
      },
      {
        id: "visible",
        title: "Visible perfume",
        handle: "visible",
        metadata: { catalog_visible: true },
        variants: [{ manage_inventory: false }],
      },
      {
        id: "soldout",
        title: "Sold out perfume",
        handle: "soldout",
        metadata: { catalog_visible: true },
        variants: [{ manage_inventory: true, inventory_quantity: 0 }],
      },
    ],
  } as never)
  try {
    render(<NavSearch />)
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "perfume" },
    })
    await act(async () => {
      jest.advanceTimersByTime(250)
    })
    await waitFor(() =>
      expect(screen.getByText("Visible perfume")).toBeTruthy(),
    )
    expect(screen.queryByText("Hidden 0")).toBeNull()
    expect(screen.queryByText("Private")).toBeNull()
    expect(screen.getByText("Sold out perfume")).toBeTruthy()
    expect(screen.getByText("Изчерпан")).toBeTruthy()
    expect(getDecantCatalogAvailability).toHaveBeenCalledWith([])
  } finally {
    jest.useRealTimers()
  }
})
