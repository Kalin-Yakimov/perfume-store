import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { isFullPerfume, perfumeFields } from "../../../../lib/full-perfume"
import { UpdateFullPerfumeInput, updateFullPerfumeWorkflow } from "../../../../workflows/update-full-perfume"

type Product = {
  id: string
  metadata: Record<string, unknown> | null
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    filters: { id: req.params.id },
    fields: perfumeFields,
  })
  const product = (data as Product[]).find((item) => isFullPerfume(item.metadata))
  if (!product) {
    res.status(404).json({ message: "Парфюмът не беше намерен." })
    return
  }
  res.json({ product })
}

export async function PATCH(req: MedusaRequest<Omit<UpdateFullPerfumeInput, "product_id">>, res: MedusaResponse) {
  const { result } = await updateFullPerfumeWorkflow(req.scope).run({
    input: { ...req.body, product_id: req.params.id },
  })
  if (result.error) {
    const status = result.error.code === "not_found" ? 404 : result.error.code === "conflict" ? 409 : 400
    res.status(status).json({ message: result.error.message })
    return
  }
  res.json({ product: result.product })
}
