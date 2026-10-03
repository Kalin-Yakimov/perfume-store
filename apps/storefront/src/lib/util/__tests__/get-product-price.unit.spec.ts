import type { HttpTypes } from "@medusajs/types"
import { getPricesForVariant, getProductPrice } from "../get-product-price"

const variant = (id: string, amount: number) => ({
  id,
  manage_inventory: false,
  calculated_price: {
    calculated_amount: amount,
    original_amount: 19.99,
    currency_code: "eur",
    calculated_price: { price_list_type: "sale" },
  },
} as unknown as Parameters<typeof getPricesForVariant>[0])

describe("calculated product prices", () => {
  it.each([
    [0, "€0.00", "100"],
    [17.99, "€17.99", "10"],
  ] as const)("retains a complete price object for the direct calculated amount %s", (amount, formatted, difference) => {
    expect(getPricesForVariant(variant("variant_1", amount))).toEqual({
      calculated_price_number: amount,
      calculated_price: formatted,
      original_price_number: 19.99,
      original_price: "€19.99",
      currency_code: "eur",
      price_type: "sale",
      percentage_diff: difference,
    })
  })

  it("selects a zero-priced variant as cheapest alongside a 17.99 variant and retains the selected variant price", () => {
    const product = {
      id: "product_1",
      variants: [variant("paid", 17.99), variant("free", 0)],
    } as unknown as HttpTypes.StoreProduct

    const result = getProductPrice({ product, variantId: "paid" })

    expect(result.cheapestPrice).toMatchObject({ calculated_price_number: 0, calculated_price: "€0.00" })
    expect(result.variantPrice).toMatchObject({ calculated_price_number: 17.99, calculated_price: "€17.99" })
    expect(product.variants?.map((item) => item.id)).toEqual(["paid", "free"])
  })
})
