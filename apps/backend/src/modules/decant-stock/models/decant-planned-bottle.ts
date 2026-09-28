import { model } from "@medusajs/framework/utils"

// A sealed retail bottle reserved for made-to-order decants. It is not
// physically opened until staff prepares an order using it.
export const DecantPlannedBottle = model
  .define("decant_planned_bottle", {
    id: model.id().primaryKey(),
    source_product_id: model.text(),
    source_variant_id: model.text(),
    source_volume_ml: model.float(),
    usable_ml: model.float(),
    inventory_item_id: model.text(),
    location_id: model.text(),
    reservation_id: model.text(),
    opened_bottle_id: model.text().nullable(),
    status: model.enum(["planned", "opened", "released"]).default("planned"),
  })
  .indexes([
    { on: ["source_product_id", "status"] },
    { on: ["reservation_id"], unique: true },
  ])
