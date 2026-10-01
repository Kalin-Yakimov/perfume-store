import { sdk } from "@lib/config"
import { getDecantCatalogAvailability } from "../decant-stock"
jest.mock("@lib/config", () => ({ sdk: { client: { fetch: jest.fn() } } }))
jest.mock("../cart", () => ({ retrieveCart: jest.fn() }))

describe("batched catalog stock", () => {
  beforeEach(() => jest.resetAllMocks())
  it("checks every decant beyond 200 and deduplicates IDs", async () => {
    const ids = Array.from({ length: 451 }, (_, i) => `prod_${i}`)
    jest
      .mocked(sdk.client.fetch)
      .mockImplementation(async (_path, options) => ({
        product_availability: Object.fromEntries(
          (options?.query?.product_id as string[]).map((id) => [
            id,
            id !== "prod_450",
          ]),
        ),
      }))
    const result = await getDecantCatalogAvailability([...ids, ids[0]])
    expect(sdk.client.fetch).toHaveBeenCalledTimes(3)
    expect(Object.keys(result || {})).toHaveLength(451)
    expect(result?.prod_450).toBe(false)
    expect(
      jest
        .mocked(sdk.client.fetch)
        .mock.calls.map(
          ([, options]) => (options?.query?.product_id as string[]).length,
        ),
    ).toEqual([200, 200, 51])
  })
  it("returns unknown, not sold out, if a later batch fails", async () => {
    jest
      .mocked(sdk.client.fetch)
      .mockResolvedValueOnce({ product_availability: { prod_0: false } })
      .mockRejectedValueOnce(new Error("offline"))
    expect(
      await getDecantCatalogAvailability(
        Array.from({ length: 201 }, (_, i) => `prod_${i}`),
      ),
    ).toBeNull()
  })
  it("does not request an empty batch", async () => {
    expect(await getDecantCatalogAvailability([])).toBeNull()
    expect(sdk.client.fetch).not.toHaveBeenCalled()
  })
})
