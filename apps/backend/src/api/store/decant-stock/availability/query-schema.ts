import { z } from "@medusajs/framework/zod"

const id = z.string().trim().min(1).max(128)
export const decantAvailabilityQuerySchema = z.object({
  product_id: z
    .union([id, z.array(id).min(1).max(200)])
    .transform((value) => [...new Set(Array.isArray(value) ? value : [value])]),
  cart_id: id.optional(),
})
