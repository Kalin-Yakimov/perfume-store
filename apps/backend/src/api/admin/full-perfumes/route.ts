import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { readFullPerfumeList } from "../../../lib/full-perfume-list"
import type { FullPerfumeListQuery } from "./query-schema"
import { createFullPerfumeWorkflow } from "../../../workflows/create-full-perfume"
import type { CreateFullPerfumeBody } from "../products/validators"

export async function GET(
  req: AuthenticatedMedusaRequest & { validatedQuery: FullPerfumeListQuery },
  res: MedusaResponse,
) {
  res.json(await readFullPerfumeList(req.scope, req.validatedQuery))
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
