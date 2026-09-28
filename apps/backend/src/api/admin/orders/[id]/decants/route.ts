import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { DECANT_STOCK_MODULE } from "../../../../../modules/decant-stock"
import DecantStockModuleService from "../../../../../modules/decant-stock/service"
import {
  linkDecantAllocationsForOrder,
  prepareDecantOrderWorkflow,
} from "../../../../../workflows/prepare-decant-order"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const orderId = req.params.id
  const orderService = req.scope.resolve(Modules.ORDER)
  await orderService.retrieveOrder(orderId)
  await linkDecantAllocationsForOrder(req.scope, orderId)

  const service: DecantStockModuleService = req.scope.resolve(DECANT_STOCK_MODULE)
  const allocations = await service.listDecantAllocations({ order_id: orderId })
  const sourceProductIds = [...new Set(allocations.map((item) => item.source_product_id))]
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: sourceProducts } = sourceProductIds.length
    ? await query.graph({
        entity: "product",
        filters: { id: sourceProductIds },
        fields: ["id", "title"],
      })
    : { data: [] as { id: string; title: string }[] }
  const titles = new Map<string, string>(
    sourceProducts.map((product) => [product.id, product.title] as [string, string])
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
