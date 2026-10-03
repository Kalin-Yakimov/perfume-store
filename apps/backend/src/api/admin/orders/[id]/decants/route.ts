import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { readDecantAllocationsForOrder } from "../../../../../workflows/decant-order-operations"
import { prepareDecantOrderWorkflow } from "../../../../../workflows/prepare-decant-order"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const orderId = req.params.id
  const orderService = req.scope.resolve(Modules.ORDER)
  await orderService.retrieveOrder(orderId)
  const allocations = await readDecantAllocationsForOrder(req.scope, orderId)
  const sourceProductIds = [
    ...new Set(allocations.map((item) => item.source_product_id)),
  ]
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: sourceProducts } = sourceProductIds.length
    ? await query.graph({
        entity: "product",
        filters: { id: sourceProductIds },
        fields: ["id", "title"],
      })
    : { data: [] as { id: string; title: string }[] }
  const titles = new Map<string, string>(
    sourceProducts.map(
      (product) => [product.id, product.title] as [string, string],
    ),
  )

  res.json({
    allocations: allocations.map((item) => ({
      id: item.id,
      source_product_id: item.source_product_id,
      source_title: titles.get(item.source_product_id) || "Парфюм",
      volume_ml: item.volume_ml,
      status: item.status,
      bottle_kind: item.bottle_kind,
      bottle_id: item.bottle_id,
    })),
  })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { result } = await prepareDecantOrderWorkflow(req.scope).run({
    input: { order_id: req.params.id },
  })
  res.json(result)
}
