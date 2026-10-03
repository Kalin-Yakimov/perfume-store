import { decantVariantIdsByVolume } from "../decant-products"
import {
  CreateFullPerfumeBodySchema,
  UpdateFullPerfumeBodySchema,
  UpdateDecantSettingsBodySchema,
  UpdatePerfumeProfileBodySchema,
} from "../../api/admin/products/validators"

describe("full perfume input contracts", () => {
  const body = { name: "Bottle", designer_id: "designer", concentration: "Парфюмна вода", gender: "Унисекс", volume_ml: 100, price_eur: 49.99 }
  it("defaults initial inventory to zero without changing decimal euro prices", () => {
    expect(CreateFullPerfumeBodySchema.parse(body)).toEqual({ ...body, initial_quantity: 0 })
  })
  it("rejects malformed or coerced input before attempting mutations", () => {
    expect(CreateFullPerfumeBodySchema.safeParse({ ...body, name: 7 }).success).toBe(false)
    expect(CreateFullPerfumeBodySchema.safeParse({ ...body, initial_quantity: -1 }).success).toBe(false)
    expect(CreateFullPerfumeBodySchema.safeParse({ ...body, price_eur: "49.99" }).success).toBe(false)
  })
  it("requires structured volume and price for the existing full-perfume update contract", () => {
    expect(UpdateFullPerfumeBodySchema.safeParse({ volume_ml: 75, price_eur: 39.99 }).success).toBe(true)
    expect(UpdateFullPerfumeBodySchema.safeParse({ name: "Changed Bottle" }).success).toBe(false)
  })
})

describe("decant settings validation", () => {
  const variants = [
    { volume_ml: 5, enabled: true, price_eur: 2.99 },
    { volume_ml: 10, enabled: false, price_eur: 0 },
  ]
  it("accepts distinct structured variants without modifying prices", () => {
    expect(UpdateDecantSettingsBodySchema.parse({ variants }).variants).toEqual(
      variants,
    )
  })
  it("rejects duplicate volumes rather than silently accepting two 5 ml rows", () => {
    expect(
      UpdateDecantSettingsBodySchema.safeParse({
        variants: [variants[0], variants[0]],
      }).success,
    ).toBe(false)
  })
  it.each([-1, NaN, Infinity])(
    "rejects invalid price %s even for disabled variants",
    (price) => {
      expect(
        UpdateDecantSettingsBodySchema.safeParse({
          variants: [variants[0], { ...variants[1], price_eur: price }],
        }).success,
      ).toBe(false)
    },
  )
  it("does not coerce string and boolean request values", () => {
    expect(
      UpdateDecantSettingsBodySchema.safeParse({ variants, enabled: "false" })
        .success,
    ).toBe(false)
    expect(
      UpdateDecantSettingsBodySchema.safeParse({
        variants: [{ ...variants[0], volume_ml: "5" }, variants[1]],
      }).success,
    ).toBe(false)
  })
  it("accepts both price variants and maps only their own IDs", () => {
    expect(
      decantVariantIdsByVolume([
        { id: "ten", title: "10 ml" },
        { id: "five", title: "5 ml" },
      ]),
    ).toEqual({ 5: "five", 10: "ten" })
  })
  it.each(
    [
      [
        { id: "one", title: "5 ml" },
        { id: "two", title: "5 ml" },
      ],
      [{ id: "one", title: "5 ml" }],
      [
        { id: "one", title: "5 ml" },
        { id: "two", title: "10 ml" },
        { id: "extra", title: "20 ml" },
      ],
    ].map((items) => ({ items })),
  )("rejects malformed linked variants %j", ({ items }) => {
    expect(() => decantVariantIdsByVolume(items)).toThrow(
      "коректните различни варианти",
    )
  })
  it("requires a profile object and validates reference arrays", () => {
    expect(
      UpdatePerfumeProfileBodySchema.safeParse({
        metadata: { perfume_profile: [] },
      }).success,
    ).toBe(false)
    expect(
      UpdatePerfumeProfileBodySchema.safeParse({
        metadata: { perfume_profile: { top_note_ids: [5] } },
      }).success,
    ).toBe(false)
    expect(
      UpdatePerfumeProfileBodySchema.safeParse({
        metadata: { perfume_profile: { top_note_ids: ["note"] } },
      }).success,
    ).toBe(true)
  })
})
