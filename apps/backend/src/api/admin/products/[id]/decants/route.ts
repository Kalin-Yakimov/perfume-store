import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import type { UpdateDecantSettingsBody } from "../../validators"
import { readSourceAndDecant } from "../../../../../lib/decant-products"
import { updateDecantSettingsWorkflow } from "../../../../../workflows/update-decant-settings"

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) {
  res.json(await readSourceAndDecant(req.scope, req.params.id))
}

export async function POST(
  req: AuthenticatedMedusaRequest<UpdateDecantSettingsBody>,
  res: MedusaResponse,
) {
  const { result } = await updateDecantSettingsWorkflow(req.scope).run({
    input: { ...req.validatedBody, product_id: req.params.id },
  })
  res.json({ decant: result })
}
