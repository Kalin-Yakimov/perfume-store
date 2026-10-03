import { randomUUID } from "node:crypto"

import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import type { CreateProductWorkflowInputDTO } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"

import { PERFUME_TAXONOMY_MODULE } from "../modules/perfume-taxonomy"
import PerfumeTaxonomyModuleService from "../modules/perfume-taxonomy/service"
import { normalizePerfumeTaxonomySlug } from "../modules/perfume-taxonomy/utils/normalize-slug"
import { perfumeFields } from "../lib/full-perfume"
import { CreateFullPerfumeBodySchema } from "../lib/perfume-settings"

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

const genderCode = (value: string) =>
  value === "Мъжки"
    ? "male"
    : value === "Женски"
      ? "female"
      : value === "Унисекс"
        ? "unisex"
        : null

const invalid = (message: string) =>
  new MedusaError(MedusaError.Types.INVALID_DATA, message)

const prepareFullPerfumeStep = createStep(
  "prepare-full-perfume",
  async (input: CreateFullPerfumeInput, { container }) => {
    const parsed = CreateFullPerfumeBodySchema.safeParse(input)
    if (!parsed.success)
      throw invalid(
        "Попълнете валидни данни за парфюма, обема, цената и наличността.",
      )
    const body = parsed.data
    const name = body.name?.trim()
    const designerId = body.designer_id?.trim()
    const concentration = body.concentration?.trim() || ""
    const gender = body.gender?.trim() || ""
    const description = body.description?.trim() || ""
    const imageUrl = body.image_url?.trim() || ""
    const volumeMl = Number(body.volume_ml)
    const priceEur = Number(body.price_eur)
    const initialQuantity = Number(body.initial_quantity ?? 0)

    if (
      !name ||
      !designerId ||
      !Number.isInteger(volumeMl) ||
      volumeMl <= 5 ||
      volumeMl > 1000
    ) {
      throw invalid(
        "Въведете име, дизайнерска къща и обем на бутилката над 5 мл.",
      )
    }
    if (!concentration || !genderCode(gender)) {
      throw invalid("Изберете концентрация и пол.")
    }
    if (!Number.isFinite(priceEur) || priceEur <= 0) {
      throw invalid("Въведете валидна цена в евро.")
    }
    if (!Number.isInteger(initialQuantity) || initialQuantity < 0) {
      throw invalid("Наличността трябва да е цяло неотрицателно число.")
    }

    const taxonomy: PerfumeTaxonomyModuleService = container.resolve(
      PERFUME_TAXONOMY_MODULE,
    )
    const designers = await taxonomy.listPerfumeTaxonomies({
      id: designerId,
      kind: "designer",
    })
    const designer = designers[0]
    if (!designer) {
      throw invalid("Изберете съществуваща дизайнерска къща.")
    }

    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const [
      { data: stores },
      { data: salesChannels },
      { data: shippingProfiles },
      { data: stockLocations },
    ] = await Promise.all([
      query.graph({
        entity: "store",
        fields: ["id", "default_sales_channel_id"],
      }),
      query.graph({ entity: "sales_channel", fields: ["id", "name"] }),
      query.graph({ entity: "shipping_profile", fields: ["id"] }),
      query.graph({
        entity: "stock_location",
        fields: ["id", "sales_channels.id"],
      }),
    ])
    const defaultChannelId = stores[0]?.default_sales_channel_id
    const salesChannel = defaultChannelId
      ? salesChannels.find((channel) => channel.id === defaultChannelId)
      : salesChannels.find((channel) =>
          stockLocations.some((location) =>
            location.sales_channels?.some(
              (linked) => linked?.id === channel.id,
            ),
          ),
        )
    const shippingProfile = shippingProfiles[0]
    const stockLocation = stockLocations.find((location) =>
      location.sales_channels?.some(
        (channel) => channel?.id === salesChannel?.id,
      ),
    )
    if (!salesChannel)
      throw invalid(
        "Липсва канал за продажби. Настройте го преди създаване на парфюм.",
      )
    if (!shippingProfile)
      throw invalid(
        "Липсва профил за доставка. Настройте го преди създаване на парфюм.",
      )
    if (!stockLocation)
      throw invalid(
        "Липсва складова локация, свързана с избрания канал за продажби. Настройте я преди създаване на парфюм.",
      )

    const cleanName = name
      .toLocaleLowerCase("bg")
      .startsWith(`${designer.name.toLocaleLowerCase("bg")} `)
      ? name.slice(designer.name.length).trim()
      : name
    if (!cleanName) {
      throw invalid("Добавете име на парфюма след дизайнерската къща.")
    }
    const title = `${designer.name} ${cleanName}`
    const baseHandle =
      normalizePerfumeTaxonomySlug(title) ||
      `parfyum-${randomUUID().slice(0, 8)}`
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
    const product: CreateProductWorkflowInputDTO = {
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
      variants: [
        {
          title: `${volumeMl} ml`,
          sku,
          manage_inventory: true,
          options: { Вид: "Цяла бутилка" },
          metadata: { volume_ml: volumeMl },
          prices: [{ amount: priceEur, currency_code: "eur" }],
        },
      ],
    }
    return new StepResponse({
      product,
      location_id: stockLocation.id,
      quantity: initialQuantity,
    })
  },
)

const prepareInitialInventoryStep = createStep(
  "prepare-initial-inventory",
  async (input: {
    inventory_item_id?: string
    location_id: string
    quantity: number
  }) => {
    if (!input.inventory_item_id) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Не беше създаден складов артикул за парфюма.",
      )
    }
    return new StepResponse({
      inventory_levels: [
        {
          inventory_item_id: input.inventory_item_id,
          location_id: input.location_id,
          stocked_quantity: input.quantity,
        },
      ],
    })
  },
)

export const createFullPerfumeWorkflow = createWorkflow(
  "create-full-perfume",
  function (input: CreateFullPerfumeInput) {
    const prepared = prepareFullPerfumeStep(input)
    const products = createProductsWorkflow.runAsStep({
      input: transform({ prepared }, ({ prepared }) => ({
        products: [prepared.product],
      })),
    })
    const { data: created } = useQueryGraphStep({
      entity: "product",
      filters: { id: products[0].id },
      fields: ["id", "variants.inventory_items.inventory_item_id"],
    })
    const inventoryInput = prepareInitialInventoryStep(
      transform({ created, prepared }, ({ created, prepared }) => ({
        inventory_item_id:
          created[0]?.variants?.[0]?.inventory_items?.[0]?.inventory_item_id,
        location_id: prepared.location_id,
        quantity: prepared.quantity,
      })),
    )
    const levels = createInventoryLevelsWorkflow.runAsStep({
      input: inventoryInput,
    })
    const { data: saved } = useQueryGraphStep({
      entity: "product",
      filters: {
        id: transform({ products, levels }, ({ products }) => products[0].id),
      },
      fields: perfumeFields,
    }).config({ name: "read-created-full-perfume" })
    return new WorkflowResponse(
      transform({ products, saved }, ({ products, saved }) => ({
        status: 201 as const,
        product_id: products[0].id,
        product: saved[0],
      })),
    )
  },
)
