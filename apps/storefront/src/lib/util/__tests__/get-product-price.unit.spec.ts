import type { HttpTypes } from "@medusajs/types"
import { getPricesForVariant, getProductPrice } from "../get-product-price"
import {
  getCustomerVariants,
  getCheapestCustomerVariant,
  getVariantVolumeLabel,
} from "../customer-variants"

const variant = (id: string, amount: number) =>
  ({
    id,
    manage_inventory: false,
    calculated_price: {
      calculated_amount: amount,
      original_amount: 19.99,
      currency_code: "eur",
      calculated_price: { price_list_type: "sale" },
    },
  }) as unknown as Parameters<typeof getPricesForVariant>[0]

describe("calculated product prices", () => {
  const decant = () =>
    ({
      id: "decant_1",
      metadata: {
        listing_type: "decant",
        decant_enabled_variant_ids: ["ten"],
        decant_variant_volumes: { five: 5, ten: 10 },
      },
      variants: [variant("five", 3), variant("ten", 5)],
    }) as unknown as HttpTypes.StoreProduct

  it("uses only enabled variants for the cheapest, selected and saved-card price/volume", () => {
    const product = decant()
    expect(getProductPrice({ product, variantId: "five" })).toMatchObject({
      cheapestPrice: { calculated_price_number: 5 },
      variantPrice: null,
    })
    expect(
      getProductPrice({ product, variantId: "ten" }).variantPrice
        ?.calculated_price_number,
    ).toBe(5)
    expect(getCustomerVariants(product).map((item) => item.id)).toEqual(["ten"])
    expect(
      getVariantVolumeLabel(product, getCheapestCustomerVariant(product)),
    ).toBe("10 мл")
    expect(product.variants).toHaveLength(2)
  })

  it.each([
    {},
    { decant_enabled_variant_ids: [] },
    { decant_enabled: false, decant_enabled_variant_ids: ["ten"] },
  ])("does not advertise unconfigured or disabled decants: %j", (metadata) => {
    const product = {
      ...decant(),
      metadata: { listing_type: "decant", ...metadata },
    }
    expect(getCustomerVariants(product)).toEqual([])
    expect(getProductPrice({ product }).cheapestPrice).toBeNull()
  })

  it("ignores non-finite prices instead of selecting them before a real price", () => {
    const product = {
      id: "bottle",
      variants: [variant("invalid", NaN), variant("real", 5)],
    } as HttpTypes.StoreProduct
    expect(
      getProductPrice({ product }).cheapestPrice?.calculated_price_number,
    ).toBe(5)
  })
  it.each([
    [0, "€0.00", "100"],
    [17.99, "€17.99", "10"],
  ] as const)(
    "retains a complete price object for the direct calculated amount %s",
    (amount, formatted, difference) => {
      expect(getPricesForVariant(variant("variant_1", amount))).toEqual({
        calculated_price_number: amount,
        calculated_price: formatted,
        original_price_number: 19.99,
        original_price: "€19.99",
        currency_code: "eur",
        price_type: "sale",
        percentage_diff: difference,
      })
    },
  )

  it("selects a zero-priced variant as cheapest alongside a 17.99 variant and retains the selected variant price", () => {
    const product = {
      id: "product_1",
      variants: [variant("paid", 17.99), variant("free", 0)],
    } as unknown as HttpTypes.StoreProduct

    const result = getProductPrice({ product, variantId: "paid" })

    expect(result.cheapestPrice).toMatchObject({
      calculated_price_number: 0,
      calculated_price: "€0.00",
    })
    expect(result.variantPrice).toMatchObject({
      calculated_price_number: 17.99,
      calculated_price: "€17.99",
    })
    expect(product.variants?.map((item) => item.id)).toEqual(["paid", "free"])
  })
})
