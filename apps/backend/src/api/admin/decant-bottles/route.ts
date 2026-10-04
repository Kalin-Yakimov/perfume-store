import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  DECANT_RESERVE_ML,
  DECANT_STOCK_MODULE,
} from "../../../modules/decant-stock"
import DecantStockModuleService from "../../../modules/decant-stock/service"
import { openManualDecantBottleWorkflow } from "../../../workflows/open-manual-decant-bottle"
import { readDecantStockProductNames } from "../../../lib/decant-stock-product-names"

type OpenBottleBody = {
  source_product_id?: string
  source_variant_id?: string
  source_volume_ml?: number
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: DecantStockModuleService =
    req.scope.resolve(DECANT_STOCK_MODULE)
  const sourceProductId = req.query.source_product_id
  const bottles = await service.listDecantBottles(
    typeof sourceProductId === "string"
      ? { source_product_id: sourceProductId }
      : {},
  )
  const planned = await service.listDecantPlannedBottles(
    typeof sourceProductId === "string"
      ? { source_product_id: sourceProductId, status: "planned" }
      : { status: "planned" },
  )
  const plannedIds = planned.map((item) => item.id)
  const bottleIds = bottles.map((item) => item.id)
  const allocations = plannedIds.length
    ? await service.listDecantAllocations({
        bottle_kind: "planned",
        bottle_id: plannedIds,
        status: "reserved",
      })
    : []
  const reservedByPlanned = new Map<string, number>()
  for (const allocation of allocations) {
    reservedByPlanned.set(
      allocation.bottle_id,
      (reservedByPlanned.get(allocation.bottle_id) || 0) + allocation.volume_ml,
    )
  }
  const openAllocations = bottleIds.length
    ? await service.listDecantAllocations({
        bottle_kind: "open",
        bottle_id: bottleIds,
        status: "reserved",
      })
    : []
  const reservedByOpen = new Map<string, number>()
  for (const allocation of openAllocations) {
    reservedByOpen.set(
      allocation.bottle_id,
      (reservedByOpen.get(allocation.bottle_id) || 0) + allocation.volume_ml,
    )
  }

  res.json({
    products: await readDecantStockProductNames(
      req.scope,
      [...bottles, ...planned].map((item) => item.source_product_id),
    ),
    bottles: bottles
      .sort((a, b) => b.opened_at.getTime() - a.opened_at.getTime())
      .map((item) => ({
        ...item,
        reserved_ml: reservedByOpen.get(item.id) || 0,
        free_ml: Math.max(
          0,
          item.remaining_ml - (reservedByOpen.get(item.id) || 0),
        ),
      })),
    planned_bottles: planned.map((item) => ({
      id: item.id,
      source_product_id: item.source_product_id,
      source_variant_id: item.source_variant_id,
      source_volume_ml: item.source_volume_ml,
      usable_ml: item.usable_ml,
      reserved_ml: reservedByPlanned.get(item.id) || 0,
    })),
    reserve_ml: DECANT_RESERVE_ML,
  })
}

export async function POST(
  req: MedusaRequest<OpenBottleBody>,
  res: MedusaResponse,
) {
  const sourceProductId = req.body.source_product_id?.trim()
  const sourceVariantId = req.body.source_variant_id?.trim()
  const sourceVolumeMl = Number(req.body.source_volume_ml)

  if (
    !sourceProductId ||
    !sourceVariantId ||
    !Number.isFinite(sourceVolumeMl)
  ) {
    res.status(400).json({
      message: "Изберете парфюм, разфасовка и въведете обема на бутилката.",
    })
    return
  }

  if (sourceVolumeMl <= DECANT_RESERVE_ML) {
    res.status(400).json({
      message: `Обемът трябва да е по-голям от резерва от ${DECANT_RESERVE_ML} мл.`,
    })
    return
  }

  const { result: bottle } = await openManualDecantBottleWorkflow(
    req.scope,
  ).run({
    input: {
      source_product_id: sourceProductId,
      source_variant_id: sourceVariantId,
      source_volume_ml: sourceVolumeMl,
    },
  })

  res.status(201).json({ bottle, reserve_ml: DECANT_RESERVE_ML })
}
