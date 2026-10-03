import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { adjustInventoryLevelsStep } from "@medusajs/medusa/core-flows"

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

const prepareStockReceiptStep = createStep(
  "prepare-stock-receipt",
  async (input: Input, { container }) => {
    if (
      !Number.isInteger(input.received_quantity) ||
      input.received_quantity < 1
    ) {
      throw invalid("Въведете положителен брой получени бутилки.")
    }
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: products } = await query.graph({
      entity: "product",
      filters: { id: input.product_id },
      fields: ["id", "metadata", "variants.id"],
    })
    const product = products[0]
    const isPerfume =
      product?.metadata?.listing_type === "full_perfume" ||
      (product?.metadata?.listing_type !== "decant" &&
        typeof product?.metadata?.brand === "string")
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
    if (
      variant?.inventory_items?.length !== 1 ||
      !item ||
      Number(item.required_quantity || 1) !== 1
    ) {
      throw invalid(
        "Този парфюм няма еднозначен складов артикул. Проверете настройката му в Inventory.",
      )
    }
    const levelsBefore = item.inventory?.location_levels || []
    if (levelsBefore.length > 1) {
      throw invalid(
        "Този парфюм има наличности в повече от един склад. Изберете склад от разширените настройки в Inventory.",
      )
    }
    const location = levelsBefore[0]
    if (!location) {
      throw invalid("Липсва складова локация за този парфюм.")
    }
    return new StepResponse([
      {
        inventory_item_id: item.inventory_item_id,
        location_id: location.location_id,
        adjustment: input.received_quantity,
      },
    ])
  },
)

export const receiveFullPerfumeStockWorkflow = createWorkflow(
  "receive-full-perfume-stock",
  function (input: Input) {
    const prepared = prepareStockReceiptStep(input)
    const levels = adjustInventoryLevelsStep(prepared)
    // Use the committed adjustment result: a follow-up read must not turn a
    // successful receipt into an apparent failure that the admin might retry.
    return new WorkflowResponse(
      transform({ levels }, ({ levels }) => {
        const stocked = levels.reduce(
          (sum, level) => sum + Number(level.stocked_quantity || 0),
          0,
        )
        const reserved = levels.reduce(
          (sum, level) => sum + Number(level.reserved_quantity || 0),
          0,
        )
        return {
          stocked_quantity: stocked,
          reserved_quantity: reserved,
          available_quantity: Math.max(0, stocked - reserved),
        }
      }),
    )
  },
)
