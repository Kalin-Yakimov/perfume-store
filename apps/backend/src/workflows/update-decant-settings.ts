import type { CreateProductWorkflowInputDTO } from "@medusajs/framework/types"
import {
  acquireLockStep,
  createProductsWorkflow,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import {
  ContainerRegistrationKeys,
  MedusaError,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  UpdateDecantSettingsBodySchema,
  type UpdateDecantSettingsBody,
} from "../lib/perfume-settings"
import {
  decantVariantIdsByVolume,
  readSourceAndDecant,
  type DecantProductRecord,
} from "../lib/decant-products"
import { sourceMetadataForDecant } from "../lib/decant-profile"
import { readBottleVolumeMl } from "../lib/perfume-volume"
import { decantSourceLock } from "../modules/decant-stock/reservation"
import {
  updatePerfumeProductsWorkflow,
  type UpdatePerfumeProductsInput,
} from "./update-perfume-products"

type Input = UpdateDecantSettingsBody & { product_id: string }
const invalid = (message: string) =>
  new MedusaError(MedusaError.Types.INVALID_DATA, message)

const prepareDecantSettingsStep = createStep(
  "prepare-decant-settings",
  async (input: Input, { container }) => {
    const parsed = UpdateDecantSettingsBodySchema.safeParse(input)
    if (!parsed.success)
      throw invalid("Нужни са различни варианти 5 мл и 10 мл с валидни цени.")
    const settings = parsed.data
    const variants = [...settings.variants].sort(
      (a, b) => a.volume_ml - b.volume_ml,
    )
    const active = variants.filter((variant) => variant.enabled)
    if (
      settings.enabled !== false &&
      (!active.length || active.some((variant) => variant.price_eur <= 0))
    ) {
      throw invalid("Включете поне една разфасовка и въведете цена в евро.")
    }
    const { source, decant } = await readSourceAndDecant(
      container,
      input.product_id,
    )
    if (decant) decantVariantIdsByVolume(decant.variants || [])
    const sourceVariant = source.variants?.find(
      (variant) => variant.id === settings.source_variant_id,
    )
    const sourceVolume = sourceVariant
      ? readBottleVolumeMl(sourceVariant)
      : undefined
    if (settings.enabled !== false && !sourceVariant)
      throw invalid("Изберете цяла разфасовка, от която ще правите отливките.")
    if (settings.enabled !== false && (!sourceVolume || sourceVolume <= 5))
      throw invalid(
        "Задайте обем над 5 мл в полето „Обем на бутилката“ на целия парфюм.",
      )
    const metadata = {
      listing_type: "decant",
      decant_source_product_id: source.id,
      decant_source_variant_id:
        sourceVariant?.id || decant?.metadata?.decant_source_variant_id || null,
      decant_source_volume_ml:
        sourceVolume || decant?.metadata?.decant_source_volume_ml || null,
      decant_enabled: settings.enabled !== false,
      catalog_visible:
        settings.enabled !== false && settings.catalog_visible === true,
      ...sourceMetadataForDecant(source.metadata),
    }
    let create: CreateProductWorkflowInputDTO | null = null
    if (!decant && settings.enabled !== false) {
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: profiles } = await query.graph({
        entity: "shipping_profile",
        fields: ["id"],
        pagination: { take: 1 },
      })
      const salesChannelIds =
        source.sales_channels?.map((channel) => channel.id) || []
      if (!salesChannelIds.length) {
        const { data: stores } = await query.graph({
          entity: "store",
          fields: ["id", "default_sales_channel_id"],
          pagination: { take: 1 },
        })
        const defaultChannelId = stores[0]?.default_sales_channel_id
        if (defaultChannelId) {
          const { data: channels } = await query.graph({
            entity: "sales_channel",
            filters: { id: defaultChannelId },
            fields: ["id"],
          })
          if (channels[0]?.id) salesChannelIds.push(channels[0].id)
        }
      }
      if (!salesChannelIds.length || !profiles[0]?.id)
        throw invalid(
          "Липсва Sales channel или Shipping profile за създаване на отливката.",
        )
      create = {
        title: `${source.title} — Отливки`,
        handle: `${source.handle || source.id}-otlivka`,
        subtitle: source.subtitle || undefined,
        description: source.description || undefined,
        thumbnail: source.thumbnail || undefined,
        weight: source.weight || undefined,
        // Query results can contain image IDs even when only URLs are selected.
        // Images belong to one product, so copying IDs would move the gallery.
        images: (source.images || []).map((image) => ({ url: image.url })),
        status:
          source.status === ProductStatus.PUBLISHED
            ? ProductStatus.PUBLISHED
            : ProductStatus.DRAFT,
        shipping_profile_id: profiles[0].id,
        sales_channels: salesChannelIds.map((id) => ({ id })),
        metadata,
        options: [{ title: "Разфасовка", values: ["5 ml", "10 ml"] }],
        variants: variants.map((variant) => ({
          title: `${variant.volume_ml} ml`,
          sku: `${sourceVariant?.sku || source.id}-DEC-${variant.volume_ml}`,
          manage_inventory: false,
          options: { Разфасовка: `${variant.volume_ml} ml` },
          prices: [{ amount: variant.price_eur, currency_code: "eur" }],
        })),
      }
    }
    return new StepResponse({
      source,
      decant,
      variants,
      settings,
      metadata,
      create,
      noop: !decant && settings.enabled === false,
    })
  },
)

// Explicit step input avoids using workflow-proxy types as serialized records.
const prepareDecantUpdateStep = createStep(
  "prepare-decant-update",
  async (input: {
    prepared: {
      source: DecantProductRecord
      decant: DecantProductRecord | null
      variants: UpdateDecantSettingsBody["variants"]
      settings: UpdateDecantSettingsBody
      metadata: Record<string, unknown>
    }
    created?: { id: string; variants: { id: string; title: string }[] }[]
  }) => {
    const { prepared } = input
    const decant = prepared.decant || input.created?.[0]
    if (!decant)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Отливката не беше създадена.",
      )
    const ids = decantVariantIdsByVolume(decant.variants || [])
    const source = prepared.source
    const updates: UpdatePerfumeProductsInput = {
      products: [
        {
          id: decant.id,
          title: `${source.title} — Отливки`,
          status:
            source.status === ProductStatus.PUBLISHED
              ? ProductStatus.PUBLISHED
              : ProductStatus.DRAFT,
          subtitle: source.subtitle,
          description: source.description,
          thumbnail: source.thumbnail,
          images: (source.images || []).map((image) => ({ url: image.url })),
          metadata: {
            ...(prepared.decant?.metadata || {}),
            ...prepared.metadata,
            decant_variant_volumes: Object.fromEntries(
              prepared.variants.map((variant) => [
                ids[variant.volume_ml],
                variant.volume_ml,
              ]),
            ),
            decant_enabled_variant_ids: prepared.variants
              .filter(
                (variant) =>
                  variant.enabled && prepared.settings.enabled !== false,
              )
              .map((variant) => ids[variant.volume_ml]),
          },
          variants: prepared.variants.map((variant) => ({
            id: ids[variant.volume_ml],
            prices: [{ amount: variant.price_eur, currency_code: "eur" }],
          })),
        },
      ],
    }
    return new StepResponse(updates)
  },
)

export const updateDecantSettingsWorkflow = createWorkflow(
  "update-decant-settings",
  function (input: Input) {
    const key = transform({ input }, ({ input }) =>
      [
        decantSourceLock(input.product_id),
        `perfume-settings:${input.product_id}`,
      ].sort(),
    )
    const lock = acquireLockStep({ key, timeout: 10, ttl: 120 })
    const prepared = prepareDecantSettingsStep(
      transform({ input, lock }, ({ input }) => input),
    )
    const created = when(
      "create-missing-decant-product",
      { prepared },
      ({ prepared }) => prepared.create !== null,
    ).then(() => {
      return createProductsWorkflow.runAsStep({
        input: transform({ prepared }, ({ prepared }) => ({
          products: prepared.create ? [prepared.create] : [],
        })),
      })
    })
    const saved = when(
      "save-decant-product-settings",
      { prepared },
      ({ prepared }) => !prepared.noop,
    ).then(() => {
      const updates = prepareDecantUpdateStep({ prepared, created })
      const updated = updatePerfumeProductsWorkflow.runAsStep({ input: updates })
      const { data } = useQueryGraphStep({
        entity: "product",
        filters: { id: updated[0].id },
        fields: [
          "id",
          "title",
          "handle",
          "metadata",
          "variants.id",
          "variants.title",
          "variants.sku",
        ],
      })
      return data
    })
    const released = releaseLockStep(
      transform({ saved, key }, ({ key }) => ({ key })),
    )
    return new WorkflowResponse(
      transform({ saved, released }, ({ saved }) => saved?.[0] || null),
    )
  },
)
