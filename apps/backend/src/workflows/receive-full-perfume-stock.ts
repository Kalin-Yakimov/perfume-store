import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"

type Input = { product_id: string; received_quantity: number }

type InventoryVariant = {
  id: string
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

const receiveStockStep = createStep(
  "receive-stock",
  async (input: Input, { container }) => {
    if (!Number.isInteger(input.received_quantity) || input.received_quantity < 1) {
      throw invalid("Въведете положителен брой получени бутилки.")
    }
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: products } = await query.graph({
      entity: "product",
      filters: { id: input.product_id },
      fields: ["id", "metadata", "variants.id"],
    })
    const product = products[0]
    const isPerfume = product?.metadata?.listing_type === "full_perfume" ||
      (product?.metadata?.listing_type !== "decant" && typeof product?.metadata?.brand === "string")
    if (!product || !isPerfume || product.variants?.length !== 1) {
      throw invalid("Изберете цял парфюм с една разфасовка.")
    }
    const { data: variants } = await query.graph({
      entity: "product_variant",
      filters: { id: product.variants[0].id },
      fields: [
        "id",
        "inventory_items.inventory_item_id",
        "inventory_items.required_quantity",
        "inventory_items.inventory.location_levels.location_id",
        "inventory_items.inventory.location_levels.stocked_quantity",
        "inventory_items.inventory.location_levels.reserved_quantity",
      ],
    })
    const variant = variants[0] as InventoryVariant | undefined
    const item = variant?.inventory_items?.[0]
    if (variant?.inventory_items?.length !== 1 || !item || Number(item.required_quantity || 1) !== 1) {
      throw invalid("Този парфюм няма еднозначен складов артикул. Проверете настройката му в Inventory.")
    }
    const levelsBefore = item.inventory?.location_levels || []
    if (levelsBefore.length > 1) {
      throw invalid("Този парфюм има наличности в повече от един склад. Изберете склад от разширените настройки в Inventory.")
    }
    const location = levelsBefore[0]
    if (!location) {
      throw invalid("Липсва складова локация за този парфюм.")
    }
    const inventory = container.resolve(Modules.INVENTORY)
    await inventory.adjustInventory(item.inventory_item_id, location.location_id, input.received_quantity)
    const { data: refreshed } = await query.graph({
      entity: "product_variant",
      filters: { id: variant.id },
      fields: [
        "inventory_items.inventory.location_levels.stocked_quantity",
        "inventory_items.inventory.location_levels.reserved_quantity",
      ],
    })
    const levels = (refreshed[0] as InventoryVariant | undefined)?.inventory_items?.[0]?.inventory?.location_levels || []
    const stockedQuantity = levels.reduce((sum, level) => sum + Number(level.stocked_quantity || 0), 0)
    const reservedQuantity = levels.reduce((sum, level) => sum + Number(level.reserved_quantity || 0), 0)
    return new StepResponse({
      stocked_quantity: stockedQuantity,
      reserved_quantity: reservedQuantity,
      available_quantity: Math.max(0, stockedQuantity - reservedQuantity),
    })
  }
)

export const receiveFullPerfumeStockWorkflow = createWorkflow(
  "receive-full-perfume-stock",
  (input: Input) => new WorkflowResponse(receiveStockStep(input))
)
