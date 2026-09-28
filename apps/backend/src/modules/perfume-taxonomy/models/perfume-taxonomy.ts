import { model } from "@medusajs/framework/utils"

export const PerfumeTaxonomy = model
  .define("perfume_taxonomy", {
    id: model.id().primaryKey(),
    kind: model.enum(["designer", "note", "accord"]),
    name: model.text(),
    original_name: model.text().nullable(),
    slug: model.text(),
    image_url: model.text().nullable(),
  })
  .indexes([
    {
      on: ["kind", "slug"],
      unique: true,
    },
  ])
