import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, ProductStatus } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

const querySchema = z.object({
  source_product_id: z.string().trim().min(1).max(128),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(100),
})

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const parsed = querySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({ message: "Невалидна заявка за свързани отливки." })
    return
  }
  const { source_product_id, offset, limit } = parsed.data
  // Nested JSON filters must go through the owning module, not query.graph.
  const filters = {
    status: ProductStatus.PUBLISHED,
    metadata: {
      listing_type: "decant",
      decant_source_product_id: source_product_id,
      catalog_visible: true,
    },
  }
  const [products, count] = await req.scope
    .resolve(Modules.PRODUCT)
    .listAndCountProducts(filters, {
      select: ["id"],
      take: limit,
      skip: offset,
      order: { id: "ASC" },
    })
  res.setHeader("Cache-Control", "no-store")
  res.json({ product_ids: products.map((product) => product.id), count })
}
