import { z } from "@medusajs/framework/zod"

const strings = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => (Array.isArray(value) ? value : [value]))
  .pipe(z.array(z.string().trim().min(1).max(128)).max(50))
  .optional()

export const CatalogQuerySchema = z
  .object({
    region_id: z.string().trim().min(1).max(128),
    sales_channel_id: z.string().trim().min(1).max(128).optional(),
    offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(40),
    sort: z
      .enum(["created_at", "price_asc", "price_desc"])
      .default("created_at"),
    listing_type: z.enum(["full_perfume", "decant"]).optional(),
    q: z.string().trim().max(200).optional(),
    gender: strings,
    season: strings,
    brand: strings,
    note: strings,
    id: strings,
    category_id: strings,
    collection_id: strings,
    option_value_id: strings,
    min_price: z.coerce.number().finite().min(0).optional(),
    max_price: z.coerce.number().finite().min(0).optional(),
    facets: z.enum(["true", "false"]).default("false"),
  })
  .strict()
  .refine(
    (value) =>
      value.min_price === undefined ||
      value.max_price === undefined ||
      value.min_price <= value.max_price,
    {
      message: "Minimum price cannot exceed maximum price",
      path: ["min_price"],
    },
  )

export type CatalogQuery = z.infer<typeof CatalogQuerySchema>
