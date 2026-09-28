import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { adjustDecantBottleWorkflow } from "../../../../../workflows/adjust-decant-bottle"

type AdjustmentReason = "sale" | "sample" | "loss" | "correction"

type AdjustmentBody = {
  change_ml?: number
  reason?: AdjustmentReason
  note?: string
}

const isReason = (value: unknown): value is AdjustmentReason =>
  value === "sale" ||
  value === "sample" ||
  value === "loss" ||
  value === "correction"

export async function POST(
  req: MedusaRequest<AdjustmentBody>,
  res: MedusaResponse
) {
  const changeMl = Number(req.body.change_ml)

  if (!Number.isFinite(changeMl) || changeMl === 0 || !isReason(req.body.reason)) {
    res.status(400).json({ message: "Въведете валидна промяна и причина." })
    return
  }

  const { result: updatedBottle } = await adjustDecantBottleWorkflow(req.scope).run({
    input: {
      bottle_id: req.params.id,
      change_ml: changeMl,
      reason: req.body.reason,
      note: req.body.note?.trim() || null,
    },
  })

  res.json({ bottle: updatedBottle })
}
