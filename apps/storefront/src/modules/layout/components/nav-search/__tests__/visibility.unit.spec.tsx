/** @jest-environment jsdom */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { sdk } from "@lib/config"
import { getDecantCatalogAvailability } from "@lib/data/decant-stock"
import NavSearch from ".."

jest.mock("@lib/config", () => ({
  sdk: { client: { fetch: jest.fn() } },
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

describe("catalog search results", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const search = async () => {
    render(<NavSearch />)
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: " perfume " },
    })
    await act(async () => {
      jest.advanceTimersByTime(250)
    })
  }

  it("renders all six backend results in order using backend availability without a separate stock request", async () => {
    const products = ["z", "b", "f", "a", "e", "c"].map((id) => ({
      id: `product_${id}`,
      title: `Perfume ${id}`,
      handle: `perfume-${id}`,
      metadata: { catalog_visible: true },
      variants: [{ manage_inventory: true, inventory_quantity: 0 }],
    }))
    products[0].variants = [{ manage_inventory: false, inventory_quantity: 5 }]
    jest.mocked(sdk.client.fetch).mockResolvedValue({
      products,
      unavailable_product_ids: ["product_z"],
    })

    await search()

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(6))
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(
      products.map((product) => `/products/${product.handle}`),
    )
    expect(within(screen.getAllByRole("link")[0]).getByText("Изчерпан")).toBeTruthy()
    expect(screen.getAllByText("Изчерпан")).toHaveLength(1)
    expect(sdk.client.fetch).toHaveBeenCalledTimes(1)
    expect(sdk.client.fetch).toHaveBeenCalledWith("/store/catalog", {
      query: { q: "perfume", limit: 6, region_id: "region_1" },
      cache: "no-store",
    })
    expect(getDecantCatalogAvailability).not.toHaveBeenCalled()
  })

  it("keeps sorted milliliter and direct calculated-price details for available products", async () => {
    const variants = [
      { title: "10 ml", metadata: { volume_ml: 10 }, calculated_price: { calculated_amount: 9.75, currency_code: "eur" } },
      { title: "5 ml", metadata: { volume_ml: 5 }, calculated_price: { calculated_amount: 3.5, currency_code: "eur" } },
    ]
    jest.mocked(sdk.client.fetch).mockResolvedValue({
      products: [
        { id: "available", title: "Available perfume", handle: "available", metadata: { listing_type: "decant" }, variants },
        { id: "unavailable", title: "Unavailable perfume", handle: "unavailable", metadata: { listing_type: "decant" }, variants },
      ],
      unavailable_product_ids: ["unavailable"],
    })

    await search()

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(2))
    const available = within(screen.getAllByRole("link")[0])
    const unavailable = within(screen.getAllByRole("link")[1])
    expect(available.getByText(/5 мл · €3\.50\s+\/\s+10 мл · €9\.75/)).toBeTruthy()
    expect(unavailable.getByText(/^5 мл\s+\/\s+10 мл$/)).toBeTruthy()
    expect(unavailable.queryByText(/€/)).toBeNull()
    expect(unavailable.getByText("Изчерпан")).toBeTruthy()
    expect(getDecantCatalogAvailability).not.toHaveBeenCalled()
  })
})
