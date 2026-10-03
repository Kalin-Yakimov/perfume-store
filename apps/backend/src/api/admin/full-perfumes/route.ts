import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { isFullPerfume, perfumeFields } from "../../../lib/full-perfume"
import { createFullPerfumeWorkflow } from "../../../workflows/create-full-perfume"
import type { CreateFullPerfumeBody } from "../products/validators"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
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

export async function POST(
  req: AuthenticatedMedusaRequest<CreateFullPerfumeBody>,
  res: MedusaResponse,
) {
  const { result } = await createFullPerfumeWorkflow(req.scope).run({
    input: req.validatedBody,
  })
  res.status(201).json({ product: result.product })
}
