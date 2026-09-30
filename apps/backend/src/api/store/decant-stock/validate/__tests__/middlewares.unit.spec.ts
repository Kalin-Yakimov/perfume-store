import { ValidateDecantStockBodySchema } from "../middlewares"

describe("ValidateDecantStockBodySchema", () => {
  const validBody = {
    cart_id: "cart_123",
    variant_id: "variant_123",
    quantity: 1,
  }

  it("accepts a valid variant stock check", () => {
    expect(ValidateDecantStockBodySchema.safeParse(validBody).success).toBe(true)
  })

  it("accepts a valid line-item stock check", () => {
    expect(
      ValidateDecantStockBodySchema.safeParse({
        cart_id: validBody.cart_id,
        line_item_id: "item_123",
        quantity: validBody.quantity,
      }).success,
    ).toBe(true)
  })

  it.each([
    { ...validBody, quantity: 0 },
    { ...validBody, quantity: 1.5 },
    { ...validBody, quantity: 1_000_001 },
    { ...validBody, line_item_id: "item_123" },
    { cart_id: "cart_123", quantity: 1 },
  ])("rejects invalid stock check input: %o", (body) => {
    expect(ValidateDecantStockBodySchema.safeParse(body).success).toBe(false)
  })
})
