import { model } from "@medusajs/framework/utils"

export const CatalogSnapshot = model.define("catalog_snapshot", {
  id: model.id().primaryKey(),
  context_key: model.text().unique(),
  generation: model.text(),
  expires_at: model.dateTime(),
  revision: model.text(),
})
