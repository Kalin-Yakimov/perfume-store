import { model } from "@medusajs/framework/utils"

// A disposable read projection, never the source of truth for checkout stock.
export const CatalogEntry = model
  .define("catalog_entry", {
    id: model.id().primaryKey(),
    context_key: model.text(),
    generation: model.text(),
    product_id: model.text(),
    listing_type: model.enum(["full_perfume", "decant"]),
    product_created_at: model.dateTime(),
    price: model.bigNumber().nullable(),
    unavailable: model.boolean(),
    search_text: model.text(),
    gender_text: model.text(),
    season_text: model.text(),
    brand_text: model.text(),
    legacy_note_text: model.text(),
    designer_id: model.text().nullable(),
    collection_id: model.text().nullable(),
    traits: model.json(),
    brand_value: model.text().nullable(),
    brand_label: model.text().nullable(),
  })
  .indexes([
    { on: ["context_key", "generation", "product_id"], unique: true },
    {
      on: ["context_key", "generation", "listing_type", "unavailable", "price"],
    },
    {
      on: [
        "context_key",
        "generation",
        "listing_type",
        "unavailable",
        "product_created_at",
      ],
    },
  ])
