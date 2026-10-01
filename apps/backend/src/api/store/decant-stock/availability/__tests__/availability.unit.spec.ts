import { GET } from "../route"
import { decantAvailabilityQuerySchema } from "../query-schema"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

jest.mock("../../../../../modules/decant-stock/cart-preview", () => ({
  maxAdditionalDecantQuantity: jest.fn(),
}))

describe("catalog availability request bounds", () => {
  it("accepts 200 IDs, rejects 201 instead of silently truncating", () => {
    const ids = Array.from({ length: 200 }, (_, i) => `prod_${i}`)
    expect(
      decantAvailabilityQuerySchema.safeParse({ product_id: ids }).success,
    ).toBe(true)
    expect(
      decantAvailabilityQuerySchema.safeParse({ product_id: [...ids, "last"] })
        .success,
    ).toBe(false)
  })
  it.each([undefined, [], [""], " ", [42], { id: "product" }])(
    "rejects invalid IDs: %o",
    (product_id) => {
      expect(
        decantAvailabilityQuerySchema.safeParse({ product_id }).success,
      ).toBe(false)
    },
  )
  it("deduplicates IDs and validates the optional cart ID", () => {
    expect(
      decantAvailabilityQuerySchema.parse({ product_id: ["prod_1", "prod_1"] })
        .product_id,
    ).toEqual(["prod_1"])
    expect(
      decantAvailabilityQuerySchema.safeParse({
        product_id: "prod_1",
        cart_id: ["cart_1"],
      }).success,
    ).toBe(false)
  })
  it("explicitly retrieves the entire accepted batch and returns the last unavailable decant", async () => {
    const ids = Array.from({ length: 200 }, (_, i) => `prod_${i}`)
    const graph = jest.fn().mockResolvedValue({
      data: ids.map((id) => ({
        id,
        status: "published",
        metadata: { listing_type: "decant", decant_enabled: false },
        variants: [],
      })),
    })
    const json = jest.fn()
    const req = {
      query: { product_id: ids },
      scope: { resolve: () => ({ graph }) },
    }
    const res = { json, setHeader: jest.fn() }
    await GET(req as unknown as MedusaRequest, res as unknown as MedusaResponse)
    expect(graph).toHaveBeenCalledWith(
      expect.objectContaining({ pagination: { take: 200, skip: 0 } }),
    )
    expect(json.mock.calls[0][0].product_availability.prod_199).toBe(false)
  })
})
