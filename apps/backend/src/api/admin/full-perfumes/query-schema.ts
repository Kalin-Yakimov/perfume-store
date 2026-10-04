import { z } from "@medusajs/framework/zod"

export const FullPerfumeListQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()

export type FullPerfumeListQuery = z.infer<typeof FullPerfumeListQuerySchema>
