import { readBottleVolumeMl } from "../perfume-volume"

describe("readBottleVolumeMl", () => {
  it("uses the numeric volume instead of text in the title or SKU", () => {
    expect(readBottleVolumeMl({
      title: "Разфасовка",
      sku: "CUSTOM-CODE",
      metadata: { volume_ml: 105 },
    })).toBe(105)
  })

  it("uses the legacy title or SKU only for older variants", () => {
    expect(readBottleVolumeMl({ title: "100 ml", sku: null })).toBe(100)
    expect(readBottleVolumeMl({ title: "Разфасовка", sku: "ASAD-105ML" })).toBe(105)
  })

  it("does not assume a bottle volume when none is set", () => {
    expect(readBottleVolumeMl({ title: "Разфасовка", sku: "CUSTOM-CODE" })).toBeUndefined()
  })
})
