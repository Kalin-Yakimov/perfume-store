import { model } from "@medusajs/framework/utils"

// One customer decant, assigned to exactly one physical or planned bottle.
// Keeping one row per vial prevents combining two 5 ml leftovers into a
// single 10 ml decant and makes retries safe at unit granularity.
export const DecantAllocation = model
  .define("decant_allocation", {
    id: model.id().primaryKey(),
    cart_id: model.text(),
    order_id: model.text().nullable(),
    source_product_id: model.text(),
    decant_variant_id: model.text(),
    bottle_kind: model.enum(["open", "planned"]),
    bottle_id: model.text(),
    volume_ml: model.float(),
    status: model.enum(["reserved", "prepared", "released"]).default("reserved"),
  })
  .indexes([
    { on: ["cart_id", "status"] },
    { on: ["order_id", "status"] },
    { on: ["bottle_kind", "bottle_id", "status"] },
    { on: ["source_product_id", "status"] },
  ])
