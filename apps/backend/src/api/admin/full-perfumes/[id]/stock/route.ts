import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { receiveFullPerfumeStockWorkflow } from "../../../../../workflows/receive-full-perfume-stock"

type Body = { received_quantity?: number }

export async function POST(req: MedusaRequest<Body>, res: MedusaResponse) {
  const receivedQuantity = Number(req.body?.received_quantity)
  if (!Number.isInteger(receivedQuantity) || receivedQuantity < 1) {
    res.status(400).json({ message: "Въведете положителен брой получени бутилки." })
    return
  }
  const { result } = await receiveFullPerfumeStockWorkflow(req.scope).run({
    input: {
      product_id: req.params.id,
      received_quantity: receivedQuantity,
    },
  })
  res.json(result)
}
