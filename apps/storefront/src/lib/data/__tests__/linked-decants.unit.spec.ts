import { sdk } from "@lib/config"
import { listLinkedDecants } from "../products"
jest.mock("@lib/config", () => ({ sdk: { client: { fetch: jest.fn() } } }))
jest.mock("../cookies", () => ({ getAuthHeaders: jest.fn(async () => ({})) }))
jest.mock("../regions", () => ({
  getRegion: jest.fn(async () => ({ id: "region_1" })),
}))
jest.mock("../perfume-taxonomies", () => ({
  listPerfumeTaxonomies: jest.fn(async () => []),
}))
jest.mock("../product-availability", () => ({
  getUnavailableProductIds: jest.fn(),
}))

it("finds linked decants by source ID even when they are beyond the first 100 catalog products", async () => {
  jest.mocked(sdk.client.fetch).mockImplementation(async (path, options) => {
    if (path === "/store/linked-decants")
      return { product_ids: ["decant_301"], count: 1 }
    expect(options?.query?.id).toEqual(["decant_301"])
    return {
      products: [
        {
          id: "decant_301",
          title: "Aroma — Отливки",
          metadata: {
            listing_type: "decant",
            catalog_visible: true,
            decant_source_product_id: "bottle_1",
          },
        },
      ],
      count: 1,
    }
  })
  const products = await listLinkedDecants("bottle_1", "bg")
  expect(products.map((product) => product.id)).toEqual(["decant_301"])
  expect(sdk.client.fetch).toHaveBeenCalledWith(
    "/store/linked-decants",
    expect.objectContaining({
      query: { source_product_id: "bottle_1", limit: 100, offset: 0 },
    }),
  )
})

it("pages all linked IDs and excludes hidden/wrong-source results defensively", async () => {
  const ids = Array.from({ length: 101 }, (_, i) => `decant_${i}`)
  jest.mocked(sdk.client.fetch).mockImplementation(async (path, options) => {
    if (path === "/store/linked-decants") {
      const offset = Number(options?.query?.offset)
      return { product_ids: ids.slice(offset, offset + 100), count: ids.length }
    }
    const selected = options?.query?.id as string[]
    return {
      products: selected.map((id) => ({
        id,
        title: "Aroma",
        metadata: {
          listing_type: "decant",
          catalog_visible: id !== "decant_0",
          decant_source_product_id: id === "decant_1" ? "other" : "bottle_1",
        },
      })),
      count: selected.length,
    }
  })
  const products = await listLinkedDecants("bottle_1", "bg")
  expect(products).toHaveLength(99)
  expect(products.at(-1)?.id).toBe("decant_100")
})
