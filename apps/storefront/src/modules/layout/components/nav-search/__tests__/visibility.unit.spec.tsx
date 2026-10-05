/** @jest-environment jsdom */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { sdk } from "@lib/config"
import { getDecantCatalogAvailability } from "@lib/data/decant-stock"
import { listPerfumeTaxonomies } from "@lib/data/perfume-taxonomies"
import NavSearch from ".."

const mockPush = jest.fn()

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
  useRouter: () => ({ push: mockPush }),
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

  it("distinguishes a failed search from an empty result and can retry the same query", async () => {
    jest
      .mocked(sdk.client.fetch)
      .mockRejectedValueOnce(new Error("private backend details"))
      .mockResolvedValueOnce({ products: [], unavailable_product_ids: [] })
    await search()
    expect(screen.getByRole("alert").textContent).toContain(
      "Търсенето временно не е достъпно",
    )
    expect(screen.queryByText("Не открихме парфюм с това име.")).toBeNull()
    expect(screen.queryByText("private backend details")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Опитай отново" }))
    await act(async () => {
      jest.advanceTimersByTime(250)
    })
    expect(sdk.client.fetch).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByText("Не открихме парфюм с това име.")).toBeTruthy()
  })

  it("shows loading immediately rather than flashing an empty result while waiting", async () => {
    jest
      .mocked(sdk.client.fetch)
      .mockImplementationOnce(() => new Promise(() => {}))
    render(<NavSearch />)
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "rose" },
    })
    expect(screen.getByText("Търсене...")).toBeTruthy()
    expect(screen.queryByText("Не открихме парфюм с това име.")).toBeNull()
    await act(async () => {
      jest.advanceTimersByTime(250)
    })
    expect(screen.getByText("Търсене...")).toBeTruthy()
  })

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
    expect(
      screen.getAllByRole("link").map((link) => link.getAttribute("href")),
    ).toEqual(products.map((product) => `/products/${product.handle}`))
    expect(
      within(screen.getAllByRole("link")[0]).getByText("Изчерпан"),
    ).toBeTruthy()
    expect(screen.getAllByText("Изчерпан")).toHaveLength(1)
    expect(sdk.client.fetch).toHaveBeenCalledTimes(1)
    expect(sdk.client.fetch).toHaveBeenCalledWith("/store/catalog", {
      query: { q: "perfume", limit: 6, region_id: "region_1" },
      cache: "no-store",
      signal: expect.any(AbortSignal),
    })
    expect(getDecantCatalogAvailability).not.toHaveBeenCalled()
    expect(listPerfumeTaxonomies).not.toHaveBeenCalled()
  })

  it("submits directly to the canonical Bulgarian search URL", async () => {
    render(<NavSearch />)
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: " Armaf " },
    })
    fireEvent.submit(screen.getByRole("search"))
    expect(mockPush).toHaveBeenCalledWith("/parfyumi?q=Armaf")
  })

  it("keeps sorted milliliter and direct calculated-price details for available products", async () => {
    const variants = [
      {
        id: "ten",
        title: "10 ml",
        metadata: { volume_ml: 10 },
        calculated_price: { calculated_amount: 9.75, currency_code: "eur" },
      },
      {
        id: "five",
        title: "5 ml",
        metadata: { volume_ml: 5 },
        calculated_price: { calculated_amount: 3.5, currency_code: "eur" },
      },
    ]
    jest.mocked(sdk.client.fetch).mockResolvedValue({
      products: [
        {
          id: "available",
          title: "Available perfume",
          handle: "available",
          metadata: {
            listing_type: "decant",
            decant_enabled_variant_ids: ["five", "ten"],
          },
          variants,
        },
        {
          id: "unavailable",
          title: "Unavailable perfume",
          handle: "unavailable",
          metadata: {
            listing_type: "decant",
            decant_enabled_variant_ids: ["five", "ten"],
          },
          variants,
        },
      ],
      unavailable_product_ids: ["unavailable"],
    })

    await search()

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(2))
    const available = within(screen.getAllByRole("link")[0])
    const unavailable = within(screen.getAllByRole("link")[1])
    expect(
      available.getByText(/5 мл · €3\.50\s+\/\s+10 мл · €9\.75/),
    ).toBeTruthy()
    expect(unavailable.getByText(/^5 мл\s+\/\s+10 мл$/)).toBeTruthy()
    expect(unavailable.queryByText(/€/)).toBeNull()
    expect(unavailable.getByText("Изчерпан")).toBeTruthy()
    expect(getDecantCatalogAvailability).not.toHaveBeenCalled()
  })

  it("does not advertise disabled decant volumes or prices", async () => {
    jest.mocked(sdk.client.fetch).mockResolvedValue({
      products: [
        {
          id: "decant",
          title: "Decant perfume",
          handle: "decant",
          metadata: {
            listing_type: "decant",
            decant_enabled_variant_ids: ["ten"],
          },
          variants: [
            {
              id: "five",
              title: "5 ml",
              calculated_price: { calculated_amount: 3, currency_code: "eur" },
            },
            {
              id: "ten",
              title: "10 ml",
              calculated_price: { calculated_amount: 5, currency_code: "eur" },
            },
          ],
        },
      ],
      unavailable_product_ids: [],
    })
    await search()
    await waitFor(() => expect(screen.getByText("10 мл · €5.00")).toBeTruthy())
    expect(screen.queryByText(/5 мл|€3\.00/)).toBeNull()
  })
})
