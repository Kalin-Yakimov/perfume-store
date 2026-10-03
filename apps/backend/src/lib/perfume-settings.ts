import { z } from "@medusajs/framework/zod"

// Shared input contracts for HTTP validation and direct workflow callers.

const ids = z.array(z.string().trim().min(1)).max(100)
const labels = z.array(z.string().trim().min(1)).max(100)

const fullPerfumeFields = {
  volume_ml: z.number().int().gt(5).max(1000),
  price_eur: z.number().finite().positive(),
  concentration: z.string().trim().min(1),
  gender: z.enum(["Мъжки", "Женски", "Унисекс"]),
  description: z.string().optional(),
  image_url: z.string().optional(),
}
export const CreateFullPerfumeBodySchema = z.object({
  ...fullPerfumeFields,
  name: z.string().trim().min(1),
  designer_id: z.string().trim().min(1),
  initial_quantity: z.number().int().nonnegative().default(0),
})
export type CreateFullPerfumeBody = z.infer<typeof CreateFullPerfumeBodySchema>
export const UpdateFullPerfumeBodySchema = z.object({
  ...fullPerfumeFields,
  concentration: fullPerfumeFields.concentration.optional(),
  gender: fullPerfumeFields.gender.optional(),
  name: z.string().trim().min(1).optional(),
  designer_id: z.string().trim().min(1).optional(),
  catalog_visible: z.boolean().optional(),
})
export type UpdateFullPerfumeBody = z.infer<typeof UpdateFullPerfumeBodySchema>

export const UpdatePerfumeProfileBodySchema = z.object({
  metadata: z.object({
    catalog_visible: z.boolean().optional(),
    brand: z.string().nullable().optional(),
    gender: z.string().nullable().optional(),
    seasons: labels.optional(),
    perfume_notes: labels.optional(),
    perfume_accords: labels.optional(),
    perfume_profile: z.looseObject({
      designer_id: z.string().optional(),
      concentration: z.string().optional(),
      gender: z.string().optional(),
      tagline: z.string().optional(),
      seasons: labels.optional(),
      longevity: z.string().optional(),
      sillage: z.string().optional(),
      top_note_ids: ids.optional(),
      heart_note_ids: ids.optional(),
      base_note_ids: ids.optional(),
      accord_ids: ids.optional(),
    }),
  }),
})
export type UpdatePerfumeProfileBody = z.infer<
  typeof UpdatePerfumeProfileBodySchema
>

export const UpdateDecantSettingsBodySchema = z.object({
  enabled: z.boolean().optional(),
  catalog_visible: z.boolean().optional(),
  source_variant_id: z.string().trim().min(1).optional(),
  variants: z
    .array(
      z.object({
        volume_ml: z.union([z.literal(5), z.literal(10)]),
        enabled: z.boolean(),
        price_eur: z.number().finite().nonnegative(),
      }),
    )
    .length(2)
    .refine(
      (variants) => new Set(variants.map((item) => item.volume_ml)).size === 2,
      {
        message: "Нужни са различни варианти 5 мл и 10 мл.",
      },
    ),
})
export type UpdateDecantSettingsBody = z.infer<
  typeof UpdateDecantSettingsBodySchema
>
