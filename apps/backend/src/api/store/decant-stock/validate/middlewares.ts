import { z } from "@medusajs/framework/zod"

export const ValidateDecantStockBodySchema = z
  .object({
    cart_id: z.string().trim().min(1).max(128),
    line_item_id: z.string().trim().min(1).max(128).optional(),
    variant_id: z.string().trim().min(1).max(128).optional(),
    quantity: z.number().int().min(1).max(1_000_000),
  })
  .refine(
    ({ line_item_id, variant_id }) =>
      Boolean(line_item_id) !== Boolean(variant_id),
    "Provide either a line item ID or a variant ID.",
  )

export type ValidateDecantStockBody = z.infer<
  typeof ValidateDecantStockBodySchema
>
