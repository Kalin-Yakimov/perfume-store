import { randomUUID } from "node:crypto"

import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, ProductStatus } from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"

import { PERFUME_TAXONOMY_MODULE } from "../modules/perfume-taxonomy"
import PerfumeTaxonomyModuleService from "../modules/perfume-taxonomy/service"
import { normalizePerfumeTaxonomySlug } from "../modules/perfume-taxonomy/utils/normalize-slug"

export type CreateFullPerfumeInput = {
  name?: string
  designer_id?: string
  concentration?: string
  gender?: string
  volume_ml?: number
  price_eur?: number
  initial_quantity?: number
  description?: string
  image_url?: string
}

type CreateFullPerfumeResult =
  | { status: 201; product_id: string }
  | { status: 400 | 500; message: string }

const genderCode = (value: string) =>
  value === "Мъжки" ? "male" : value === "Женски" ? "female" : value === "Унисекс" ? "unisex" : null

const createFullPerfumeStep = createStep(
  "create-full-perfume",
  async (body: CreateFullPerfumeInput, { container }) => {
    const name = body.name?.trim()
    const designerId = body.designer_id?.trim()
    const concentration = body.concentration?.trim() || ""
    const gender = body.gender?.trim() || ""
    const description = body.description?.trim() || ""
    const imageUrl = body.image_url?.trim() || ""
    const volumeMl = Number(body.volume_ml)
    const priceEur = Number(body.price_eur)
    const initialQuantity = Number(body.initial_quantity ?? 0)

    if (!name || !designerId || !Number.isInteger(volumeMl) || volumeMl <= 5 || volumeMl > 1000) {
      return new StepResponse<CreateFullPerfumeResult>({ status: 400, message: "Въведете име, дизайнерска къща и обем на бутилката над 5 мл." })
    }
    if (!concentration || !genderCode(gender)) {
      return new StepResponse<CreateFullPerfumeResult>({ status: 400, message: "Изберете концентрация и пол." })
    }
    if (!Number.isFinite(priceEur) || priceEur <= 0) {
      return new StepResponse<CreateFullPerfumeResult>({ status: 400, message: "Въведете валидна цена в евро." })
    }
    if (!Number.isInteger(initialQuantity) || initialQuantity < 0) {
      return new StepResponse<CreateFullPerfumeResult>({ status: 400, message: "Наличността трябва да е цяло неотрицателно число." })
    }

    const taxonomy: PerfumeTaxonomyModuleService = container.resolve(PERFUME_TAXONOMY_MODULE)
    const designers = await taxonomy.listPerfumeTaxonomies({ id: designerId, kind: "designer" })
    const designer = designers[0]
    if (!designer) {
      return new StepResponse<CreateFullPerfumeResult>({ status: 400, message: "Изберете съществуваща дизайнерска къща." })
    }

    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const [{ data: salesChannels }, { data: shippingProfiles }, { data: stockLocations }] = await Promise.all([
      query.graph({ entity: "sales_channel", fields: ["id", "name"] }),
      query.graph({ entity: "shipping_profile", fields: ["id"] }),
      query.graph({ entity: "stock_location", fields: ["id", "sales_channels.id"] }),
    ])
    const salesChannel = salesChannels.find((channel) => channel.name === "Default Sales Channel") || salesChannels[0]
    const shippingProfile = shippingProfiles[0]
    const stockLocation = stockLocations.find((location) =>
      location.sales_channels?.some((channel) => channel?.id === salesChannel?.id)
    )
    if (!salesChannel || !shippingProfile || !stockLocation) {
      return new StepResponse<CreateFullPerfumeResult>({ status: 400, message: "Липсва канал за продажби, доставка или складова локация, свързана с канала. Настройте ги преди създаване на парфюм." })
    }

    const cleanName = name.toLocaleLowerCase("bg").startsWith(`${designer.name.toLocaleLowerCase("bg")} `)
      ? name.slice(designer.name.length).trim()
      : name
    if (!cleanName) {
      return new StepResponse<CreateFullPerfumeResult>({ status: 400, message: "Добавете име на парфюма след дизайнерската къща." })
    }
    const title = `${designer.name} ${cleanName}`
    const baseHandle = normalizePerfumeTaxonomySlug(title) || `parfyum-${randomUUID().slice(0, 8)}`
    let handle = baseHandle
    let suffix = 2
    while (true) {
      const { data: existing } = await query.graph({
        entity: "product",
        filters: { handle },
        fields: ["id"],
      })
      if (!existing.length) break
      handle = `${baseHandle}-${suffix++}`
    }

    const sku = `PF-${randomUUID().slice(0, 12).toUpperCase()}`
    const { result } = await createProductsWorkflow(container).run({
      input: {
        products: [{
          title,
          handle,
          description: description || undefined,
          thumbnail: imageUrl || undefined,
          images: imageUrl ? [{ url: imageUrl }] : [],
          status: ProductStatus.DRAFT,
          shipping_profile_id: shippingProfile.id,
          sales_channels: [{ id: salesChannel.id }],
          metadata: {
            listing_type: "full_perfume",
            catalog_visible: false,
            perfume_name: cleanName,
            brand: designer.name,
            gender: genderCode(gender),
            seasons: [],
            perfume_notes: [],
            perfume_accords: [],
            perfume_profile: {
              designer_id: designer.id,
              concentration,
              gender,
              tagline: "",
              seasons: [],
              longevity: "",
              sillage: "",
              top_note_ids: [],
              heart_note_ids: [],
              base_note_ids: [],
              accord_ids: [],
            },
          },
          // Medusa requires one option; keep it independent of ml so correcting
          // the structured bottle volume never leaves a stale option value.
          options: [{ title: "Вид", values: ["Цяла бутилка"] }],
          variants: [{
            title: `${volumeMl} ml`,
            sku,
            manage_inventory: true,
            options: { Вид: "Цяла бутилка" },
            metadata: { volume_ml: volumeMl },
            prices: [{ amount: priceEur, currency_code: "eur" }],
          }],
        }],
      },
    })

    const createdId = result[0].id
    const { data: created } = await query.graph({
      entity: "product",
      filters: { id: createdId },
      fields: ["variants.inventory_items.inventory_item_id"],
    })
    const inventoryItemId = created[0]?.variants?.[0]?.inventory_items?.[0]?.inventory_item_id
    if (!inventoryItemId) {
      return new StepResponse<CreateFullPerfumeResult>({ status: 500, message: `Парфюмът е създаден като скрита чернова (${createdId}), но складовият артикул липсва. Не го създавайте повторно.` })
    }
    try {
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: [{
            inventory_item_id: inventoryItemId,
            location_id: stockLocation.id,
            stocked_quantity: initialQuantity,
          }],
        },
      })
    } catch {
      return new StepResponse<CreateFullPerfumeResult>({ status: 500, message: `Парфюмът е създаден като скрита чернова (${createdId}), но началната наличност не беше записана. Отворете записа от списъка и не го създавайте повторно.` })
    }

    return new StepResponse<CreateFullPerfumeResult>({ status: 201, product_id: createdId })
  }
)

export const createFullPerfumeWorkflow = createWorkflow(
  "create-full-perfume",
  (input: CreateFullPerfumeInput) => new WorkflowResponse(createFullPerfumeStep(input))
)
