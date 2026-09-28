import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"

import { DECANT_RESERVE_ML, DECANT_STOCK_MODULE } from "../modules/decant-stock"
import { decantSourceLock } from "../modules/decant-stock/reservation"
import DecantStockModuleService from "../modules/decant-stock/service"
import { readBottleVolumeMl } from "../lib/perfume-volume"

type OpenBottleInput = {
  source_product_id: string
  source_variant_id: string
  source_volume_ml: number
}

type SourceVariant = {
  id: string
  product_id: string
  title: string
  sku?: string | null
  metadata?: Record<string, unknown> | null
  manage_inventory?: boolean
  inventory_items?: {
    inventory_item_id: string
    required_quantity?: number
    inventory?: {
      location_levels?: {
        location_id: string
        stocked_quantity: number
        reserved_quantity: number
      }[]
    }
  }[]
}

const invalid = (message: string) =>
  new MedusaError(MedusaError.Types.INVALID_DATA, message)

const openBottleStep = createStep(
  "open-bottle",
  async (input: OpenBottleInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const loadVariant = async () => {
      const { data } = await query.graph({
        entity: "product_variant",
        filters: { id: input.source_variant_id },
        fields: [
          "id", "product_id", "title", "sku", "metadata", "manage_inventory",
          "inventory_items.inventory_item_id",
          "inventory_items.required_quantity",
          "inventory_items.inventory.location_levels.location_id",
          "inventory_items.inventory.location_levels.stocked_quantity",
          "inventory_items.inventory.location_levels.reserved_quantity",
        ],
      })
      return data[0] as SourceVariant | undefined
    }

    const initial = await loadVariant()
    if (!initial || initial.product_id !== input.source_product_id) {
      throw invalid("Избраната разфасовка не принадлежи на този парфюм.")
    }
    const labelledVolume = readBottleVolumeMl(initial)
    if (
      labelledVolume !== input.source_volume_ml ||
      !labelledVolume || labelledVolume <= DECANT_RESERVE_ML
    ) {
      throw invalid("Въведеният обем трябва да съвпада с разфасовката на целия парфюм.")
    }
    if (
      initial.manage_inventory === false ||
      initial.inventory_items?.length !== 1 ||
      Number(initial.inventory_items[0].required_quantity || 1) !== 1
    ) {
      throw invalid("Цялата разфасовка трябва да има един складов артикул с количество 1.")
    }

    const inventoryItemId = initial.inventory_items[0].inventory_item_id
    const locking = container.resolve(Modules.LOCKING)
    const openedBottle = await locking.execute(
      [decantSourceLock(input.source_product_id), inventoryItemId].sort(),
      async () => {
        const current = await loadVariant()
        const levels = current?.inventory_items?.[0]?.inventory?.location_levels || []
        const available = levels.find((level) =>
          Number(level.stocked_quantity) - Number(level.reserved_quantity) >= 1
        )
        if (!available) {
          throw invalid("Няма свободна запечатана бутилка. Добавете наличност в Inventory.")
        }

        const inventory = container.resolve(Modules.INVENTORY)
        await inventory.adjustInventory(inventoryItemId, available.location_id, -1)
        const stock: DecantStockModuleService = container.resolve(DECANT_STOCK_MODULE)
        try {
          const bottle = await stock.createDecantBottles({
            source_product_id: input.source_product_id,
            source_variant_id: input.source_variant_id,
            source_volume_ml: labelledVolume,
            reserve_ml: DECANT_RESERVE_ML,
            initial_ml: labelledVolume - DECANT_RESERVE_ML,
            remaining_ml: labelledVolume - DECANT_RESERVE_ML,
            opened_at: new Date(),
          })
          return bottle
        } catch (error) {
          await inventory.adjustInventory(inventoryItemId, available.location_id, 1)
          throw error
        }
      }
    )
    return new StepResponse(openedBottle)
  }
)

export const openManualDecantBottleWorkflow = createWorkflow(
  "open-manual-decant-bottle",
  (input: OpenBottleInput) => new WorkflowResponse(openBottleStep(input))
)
