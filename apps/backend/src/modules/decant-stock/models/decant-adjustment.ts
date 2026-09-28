import { model } from "@medusajs/framework/utils"

export const DecantAdjustment = model
  .define("decant_adjustment", {
    id: model.id().primaryKey(),
    bottle_id: model.text(),
    order_id: model.text().nullable(),
    change_ml: model.float(),
    reason: model.enum(["sale", "sample", "loss", "correction"]),
    note: model.text().nullable(),
  })
  .indexes([
    {
      on: ["bottle_id"],
    },
    {
      on: ["order_id"],
    },
  ])
