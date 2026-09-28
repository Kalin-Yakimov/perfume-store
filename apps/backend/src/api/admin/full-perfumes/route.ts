import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { isFullPerfume, perfumeFields } from "../../../lib/full-perfume"
import {
  CreateFullPerfumeInput,
  createFullPerfumeWorkflow,
} from "../../../workflows/create-full-perfume"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const pageSize = 100
  let skip = 0
  const products: unknown[] = []
  while (true) {
    const { data } = await query.graph({
      entity: "product",
      fields: perfumeFields,
      pagination: { skip, take: pageSize },
    })
    products.push(...data.filter((product) => isFullPerfume(product.metadata)))
    if (data.length < pageSize) break
    skip += pageSize
  }
  res.json({ products })
}

export async function POST(req: MedusaRequest<CreateFullPerfumeInput>, res: MedusaResponse) {
  const { result } = await createFullPerfumeWorkflow(req.scope).run({ input: req.body || {} })
  if (result.status !== 201) {
    res.status(result.status).json({ message: result.message })
    return
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: saved } = await query.graph({
    entity: "product",
    filters: { id: result.product_id },
    fields: perfumeFields,
  })
  res.status(201).json({ product: saved[0] })
}
