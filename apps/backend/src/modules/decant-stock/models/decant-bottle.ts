import { model } from "@medusajs/framework/utils"

/**
 * One opened retail bottle used to fill decants. The 95 ml value is the
 * sellable amount, not the bottle's labelled capacity.
 */
export const DecantBottle = model
  .define("decant_bottle", {
    id: model.id().primaryKey(),
    source_product_id: model.text(),
    source_variant_id: model.text(),
    source_volume_ml: model.float(),
    reserve_ml: model.float(),
    initial_ml: model.float(),
    remaining_ml: model.float(),
    status: model.enum(["active", "depleted"]).default("active"),
    opened_at: model.dateTime(),
    closed_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      on: ["source_product_id", "status"],
    },
  ])
