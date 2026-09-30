import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { createInventoryItemsWorkflow } from "@medusajs/medusa/core-flows"

const SKU = "DEMO-PERFUME-01"

/**
 * Repairs the old demo variant created before inventory management was enabled.
 * New real products should create their inventory item as part of their normal
 * variant setup, rather than requiring this one-off script.
 */
export default async function createDemoAmberVeilInventory({
  container,
}: {
  container: MedusaContainer
}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)

  const { data: variants } = await query.graph({
    entity: "product_variant",
    filters: { sku: SKU },
    fields: ["id", "sku", "inventory_items.inventory_item_id"],
  })
  const variant = variants[0] as
    | { id: string; inventory_items?: { inventory_item_id: string }[] }
    | undefined
  if (!variant) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Variant with SKU ${SKU} was not found.`,
    )
  }
  if (variant.inventory_items?.length) {
    return
  }

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id"],
  })
  const location = locations[0] as { id: string } | undefined
  if (!location) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No stock location exists for the demo inventory item.",
    )
  }

  const { result } = await createInventoryItemsWorkflow(container).run({
    input: {
      items: [
        {
          sku: SKU,
          title: "Lattafa Amber Veil — 100 ml",
          requires_shipping: true,
          location_levels: [
            {
              location_id: location.id,
              stocked_quantity: 0,
            },
          ],
        },
      ],
    },
  })

  await link.create([
    {
      [Modules.PRODUCT]: { variant_id: variant.id },
      [Modules.INVENTORY]: { inventory_item_id: result[0].id },
    },
  ])
}
