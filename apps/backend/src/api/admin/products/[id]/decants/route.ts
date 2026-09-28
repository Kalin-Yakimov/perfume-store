import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, ProductStatus } from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  updateProductsWorkflow,
  updateProductVariantsWorkflow,
} from "@medusajs/medusa/core-flows"

import { sourceMetadataForDecant } from "../../../../../lib/decant-profile"
import { readBottleVolumeMl } from "../../../../../lib/perfume-volume"

type DecantSettingsBody = {
  enabled?: boolean
  catalog_visible?: boolean
  source_variant_id?: string
  variants?: {
    volume_ml: number
    enabled: boolean
    price_eur: number
  }[]
}

type ProductRecord = {
  id: string
  title: string
  handle: string | null
  subtitle: string | null
  description: string | null
  thumbnail: string | null
  weight: number | null
  status: string
  metadata: Record<string, unknown> | null
  images?: { url: string }[]
  sales_channels?: { id: string }[]
  variants?: {
    id: string
    title: string
    sku: string | null
    metadata?: Record<string, unknown> | null
    prices?: { amount: number; currency_code: string }[]
  }[]
}

const readMl = (value: string) => {
  const result = value.match(/(\d+(?:[.,]\d+)?)\s*ml/i)
  return result ? Number(result[1].replace(",", ".")) : undefined
}

const createHandle = (source: ProductRecord) =>
  `${source.handle || source.id}-otlivka`

const decantTitle = (source: ProductRecord) =>
  `${source.title} — Отливки (5/10 мл)`

async function loadProducts(req: MedusaRequest) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "subtitle",
      "description",
      "thumbnail",
      "weight",
      "status",
      "metadata",
      "images.url",
      "sales_channels.id",
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.metadata",
      "variants.prices.amount",
      "variants.prices.currency_code",
    ],
  })
  return data as ProductRecord[]
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sourceProductId = req.params.id
  const products = await loadProducts(req)
  const source = products.find((product) => product.id === sourceProductId)

  if (!source || source.metadata?.listing_type === "decant") {
    res.status(404).json({ message: "Целият парфюм не беше намерен." })
    return
  }

  const decant = products.find(
    (product) =>
      product.metadata?.listing_type === "decant" &&
      product.metadata?.decant_source_product_id === sourceProductId
  )

  res.json({ source, decant: decant || null })
}

export async function POST(
  req: MedusaRequest<DecantSettingsBody>,
  res: MedusaResponse
) {
  const sourceProductId = req.params.id
  const settings = req.body || {}
  const variants = (settings.variants || [])
    .filter((variant) => [5, 10].includes(Number(variant.volume_ml)))
    .map((variant) => ({
      volume_ml: Number(variant.volume_ml),
      enabled: variant.enabled === true,
      price_eur: Number(variant.price_eur),
    }))
    .sort((a, b) => a.volume_ml - b.volume_ml)

  if (variants.length !== 2) {
    res.status(400).json({ message: "Нужни са варианти 5 мл и 10 мл." })
    return
  }

  const activeVariants = variants.filter((variant) => variant.enabled)
  if (
    settings.enabled !== false &&
    (!activeVariants.length ||
      activeVariants.some(
        (variant) => !Number.isFinite(variant.price_eur) || variant.price_eur <= 0
      ))
  ) {
    res.status(400).json({
      message: "Включете поне една разфасовка и въведете цена в евро.",
    })
    return
  }

  const products = await loadProducts(req)
  const source = products.find((product) => product.id === sourceProductId)
  if (!source || source.metadata?.listing_type === "decant") {
    res.status(404).json({ message: "Целият парфюм не беше намерен." })
    return
  }

  let decant = products.find(
    (product) =>
      product.metadata?.listing_type === "decant" &&
      product.metadata?.decant_source_product_id === sourceProductId
  )
  const sourceVariant = source.variants?.find(
    (variant) => variant.id === settings.source_variant_id
  )
  const sourceVolumeMl = sourceVariant ? readBottleVolumeMl(sourceVariant) : undefined

  if (settings.enabled !== false && !sourceVariant) {
    res.status(400).json({
      message: "Изберете цяла разфасовка, от която ще правите отливките.",
    })
    return
  }

  if (settings.enabled !== false && (!sourceVolumeMl || sourceVolumeMl <= 5)) {
    res.status(400).json({
      message: "Задайте обем над 5 мл в полето „Обем на бутилката“ на целия парфюм.",
    })
    return
  }

  if (!decant && settings.enabled === false) {
    res.json({ decant: null })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const decantMetadataBase = {
    listing_type: "decant",
    decant_source_product_id: source.id,
    decant_source_variant_id:
      sourceVariant?.id || decant?.metadata?.decant_source_variant_id || null,
    decant_source_volume_ml:
      sourceVolumeMl || decant?.metadata?.decant_source_volume_ml || null,
    decant_enabled: settings.enabled !== false,
    catalog_visible:
      settings.enabled !== false && settings.catalog_visible === true,
    ...sourceMetadataForDecant(source.metadata),
  }

  if (!decant) {
    const { data: salesChannels } = await query.graph({
      entity: "sales_channel",
      fields: ["id"],
    })
    const { data: shippingProfiles } = await query.graph({
      entity: "shipping_profile",
      fields: ["id"],
    })
    const salesChannelIds =
      source.sales_channels?.map((channel) => channel.id).filter(Boolean) ||
      []
    if (!salesChannelIds.length && salesChannels[0]?.id) {
      salesChannelIds.push(salesChannels[0].id)
    }
    const shippingProfileId = shippingProfiles[0]?.id

    if (!salesChannelIds.length || !shippingProfileId) {
      res.status(400).json({
        message: "Липсва Sales channel или Shipping profile за създаване на отливката.",
      })
      return
    }

    const { result } = await createProductsWorkflow(req.scope).run({
      input: {
        products: [
          {
            title: decantTitle(source),
            subtitle: source.subtitle || undefined,
            description: source.description || undefined,
            handle: createHandle(source),
            weight: source.weight || undefined,
            status:
              source.status === ProductStatus.PUBLISHED
                ? ProductStatus.PUBLISHED
                : ProductStatus.DRAFT,
            thumbnail: source.thumbnail || undefined,
            images: source.images || [],
            shipping_profile_id: shippingProfileId,
            sales_channels: salesChannelIds.map((id) => ({ id })),
            metadata: decantMetadataBase,
            options: [{ title: "Разфасовка", values: ["5 ml", "10 ml"] }],
            variants: variants.map((variant) => ({
              title: `${variant.volume_ml} ml`,
              sku: `${sourceVariant?.sku || source.id}-DEC-${variant.volume_ml}`,
              manage_inventory: false,
              options: { "Разфасовка": `${variant.volume_ml} ml` },
              prices: [
                {
                  amount: Number.isFinite(variant.price_eur)
                    ? variant.price_eur
                    : 0,
                  currency_code: "eur",
                },
              ],
            })),
          },
        ],
      },
    })
    const { data: createdProducts } = await query.graph({
      entity: "product",
      filters: { id: result[0].id },
      fields: ["id", "title", "metadata", "variants.id", "variants.title"],
    })
    decant = createdProducts[0] as ProductRecord
  }

  const linkedVariants = decant.variants || []
  const variantIdsByVolume = new Map<number, string>()
  linkedVariants.forEach((variant) => {
    const volume = readMl(variant.title)
    if (volume) variantIdsByVolume.set(volume, variant.id)
  })

  if (variantIdsByVolume.size !== 2) {
    res.status(400).json({
      message:
        "Свързаната отливка няма коректните варианти 5 мл и 10 мл. Създайте я отново през тази секция.",
    })
    return
  }

  const volumeMap = Object.fromEntries(
    variants.map((variant) => [
      variantIdsByVolume.get(variant.volume_ml)!,
      variant.volume_ml,
    ])
  )
  const enabledIds = variants
    .filter((variant) => variant.enabled && settings.enabled !== false)
    .map((variant) => variantIdsByVolume.get(variant.volume_ml)!)

  await updateProductsWorkflow(req.scope).run({
    input: {
      products: [
        {
          id: decant.id,
          title: decantTitle(source),
          status:
            source.status === ProductStatus.PUBLISHED
              ? ProductStatus.PUBLISHED
              : ProductStatus.DRAFT,
          subtitle: source.subtitle,
          description: source.description,
          thumbnail: source.thumbnail,
          images: source.images || [],
          metadata: {
            ...(decant.metadata || {}),
            ...decantMetadataBase,
            decant_variant_volumes: volumeMap,
            decant_enabled_variant_ids: enabledIds,
          },
        },
      ],
    },
  })
  await updateProductVariantsWorkflow(req.scope).run({
    input: {
      product_variants: variants.map((variant) => ({
        id: variantIdsByVolume.get(variant.volume_ml)!,
        prices: [
          {
            amount: Number.isFinite(variant.price_eur) ? variant.price_eur : 0,
            currency_code: "eur",
          },
        ],
      })),
    },
  })

  const { data: savedProducts } = await query.graph({
    entity: "product",
    filters: { id: decant.id },
    fields: ["id", "title", "handle", "metadata", "variants.id", "variants.title", "variants.sku"],
  })
  res.json({ decant: savedProducts[0] })
}
