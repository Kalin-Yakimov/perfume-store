import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { UpdatePerfumeProfileBody } from "../../validators"
import { updatePerfumeProfileWorkflow } from "../../../../../workflows/update-perfume-profile"

export async function POST(
  req: AuthenticatedMedusaRequest<UpdatePerfumeProfileBody>,
  res: MedusaResponse,
) {
  const { result } = await updatePerfumeProfileWorkflow(req.scope).run({
    input: { ...req.validatedBody, product_id: req.params.id },
  })
  res.json({ product: result })
}
