import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError, Modules } from "@medusajs/framework/utils"

import { DECANT_STOCK_MODULE } from "../modules/decant-stock"
import { decantSourceLock } from "../modules/decant-stock/reservation"
import DecantStockModuleService from "../modules/decant-stock/service"

type AdjustmentReason = "sale" | "sample" | "loss" | "correction"
type AdjustBottleInput = {
  bottle_id: string
  change_ml: number
  reason: AdjustmentReason
  note?: string | null
}

const adjustBottleStep = createStep(
  "adjust-bottle",
  async (input: AdjustBottleInput, { container }) => {
    const stock: DecantStockModuleService = container.resolve(DECANT_STOCK_MODULE)
    const locking = container.resolve(Modules.LOCKING)
    const original = await stock.retrieveDecantBottle(input.bottle_id)

    const updatedBottle = await locking.execute(decantSourceLock(original.source_product_id), async () => {
      const bottle = await stock.retrieveDecantBottle(input.bottle_id)
      const reserved = await stock.listDecantAllocations({
        bottle_kind: "open",
        bottle_id: bottle.id,
        status: "reserved",
      })
      const reservedMl = reserved.reduce((sum, item) => sum + item.volume_ml, 0)
      const remainingMl = Math.round((bottle.remaining_ml + input.change_ml) * 100) / 100
      if (remainingMl < reservedMl || remainingMl > bottle.initial_ml) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Корекцията трябва да остави поне ${reservedMl} мл за приетите поръчки и най-много ${bottle.initial_ml} мл в бутилката.`
        )
      }

      const updated = await stock.updateDecantBottles({
        id: bottle.id,
        remaining_ml: remainingMl,
        status: remainingMl === 0 ? "depleted" : "active",
        closed_at: remainingMl === 0 ? new Date() : null,
      })
      try {
        await stock.createDecantAdjustments({
          bottle_id: bottle.id,
          change_ml: input.change_ml,
          reason: input.reason,
          note: input.note || null,
        })
      } catch (error) {
        await stock.updateDecantBottles({
          id: bottle.id,
          remaining_ml: bottle.remaining_ml,
          status: bottle.status,
          closed_at: bottle.closed_at,
        })
        throw error
      }
      return updated
    })
    return new StepResponse(updatedBottle)
  }
)

export const adjustDecantBottleWorkflow = createWorkflow(
  "adjust-decant-bottle",
  (input: AdjustBottleInput) => new WorkflowResponse(adjustBottleStep(input))
)
