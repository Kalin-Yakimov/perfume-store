import type { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"

import { DECANT_RESERVE_ML, DECANT_STOCK_MODULE } from "."
import DecantStockModuleService from "./service"
import { readBottleVolumeMl } from "../../lib/perfume-volume"
import {
  DecantBottleCapacity,
  DecantUnit,
  SealedBottleSlot,
} from "./packing"

type ProductRecord = {
  id: string
  status?: string
  metadata?: Record<string, unknown> | null
}

type CartItem = {
  product_id?: string | null
  variant_id?: string | null
  quantity?: number | null
}

type SourceVariant = {
  id: string
  product_id: string
  title: string
  sku?: string | null
  metadata?: Record<string, unknown> | null
  manage_inventory?: boolean
  inventory_items?: {
    inventory_item_id: string
    required_quantity?: number
    inventory?: {
      location_levels?: {
        location_id: string
        stocked_quantity: number
        reserved_quantity: number
        stock_locations?: {
          sales_channels?: { id: string }[]
        }[]
      }[]
    }
  }[]
}

export type SourceRequest = {
  sourceProductId: string
  sourceVariantId: string
  sourceVolumeMl: number
  units: DecantUnit[]
}

export type StockSnapshot = {
  bottles: DecantBottleCapacity[]
  sealedSlots: SealedBottleSlot[]
  usableMl: number
}

const invalid = (message: string) =>
  new MedusaError(MedusaError.Types.INVALID_DATA, message)

const volumeMap = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([id, raw]) => {
      const ml = Number(raw)
      return Number.isFinite(ml) && ml > 0 ? [[id, ml]] : []
    })
  )
}

export async function readDecantRequests(
  container: MedusaContainer,
  items: CartItem[]
): Promise<SourceRequest[]> {
  const productIds = [...new Set(items.map((item) => item.product_id).filter(
    (id): id is string => typeof id === "string"
  ))]
  if (!productIds.length) return []

  const products = await container.resolve(Modules.PRODUCT).listProducts({
    id: productIds,
  }) as ProductRecord[]
  const byId = new Map(products.map((product) => [product.id, product]))
  const bySource = new Map<string, SourceRequest>()

  for (const item of items) {
    const product = item.product_id ? byId.get(item.product_id) : undefined
    const metadata = product?.metadata
    if (metadata?.listing_type !== "decant") continue

    const sourceProductId = metadata.decant_source_product_id
    const sourceVariantId = metadata.decant_source_variant_id
    const sourceVolumeMl = Number(metadata.decant_source_volume_ml)
    const variantId = item.variant_id
    const quantity = Number(item.quantity)
    const ml = variantId ? volumeMap(metadata.decant_variant_volumes)[variantId] : undefined
    const enabledIds = metadata.decant_enabled_variant_ids

    if (
      product?.status !== "published" ||
      metadata.decant_enabled !== true ||
      metadata.catalog_visible !== true ||
      typeof sourceProductId !== "string" ||
      typeof sourceVariantId !== "string" ||
      !Number.isFinite(sourceVolumeMl) || sourceVolumeMl <= DECANT_RESERVE_ML ||
      !variantId || !ml ||
      !Array.isArray(enabledIds) || !enabledIds.includes(variantId) ||
      !Number.isInteger(quantity) || quantity < 1 || quantity > 500
    ) {
      throw invalid("Отливката не е настроена или разфасовката е изключена. Проверете настройката в оригиналния парфюм.")
    }

    let request = bySource.get(sourceProductId)
    if (!request) {
      request = { sourceProductId, sourceVariantId, sourceVolumeMl, units: [] }
      bySource.set(sourceProductId, request)
    }
    if (request.sourceVariantId !== sourceVariantId) {
      throw invalid("Има несъвместими настройки за отливките на този парфюм.")
    }
    for (let i = 0; i < quantity; i++) {
      request.units.push({ variantId, volumeMl: ml })
    }
  }

  return [...bySource.values()]
}

export async function readStockSnapshot(
  container: MedusaContainer,
  request: Pick<SourceRequest, "sourceProductId" | "sourceVariantId" | "sourceVolumeMl">,
  salesChannelId?: string | null
): Promise<StockSnapshot> {
  const stock: DecantStockModuleService = container.resolve(DECANT_STOCK_MODULE)
  const [openBottles, plannedBottles, allocations] = await Promise.all([
    // Every opened/planned bottle belongs to the same perfume. Its own
    // remaining/usable ml determines its capacity; the selected source variant
    // only determines which sealed bottle to reserve next.
    stock.listDecantBottles({ source_product_id: request.sourceProductId, status: "active" }),
    stock.listDecantPlannedBottles({ source_product_id: request.sourceProductId, status: "planned" }),
    stock.listDecantAllocations({ source_product_id: request.sourceProductId, status: "reserved" }),
  ])

  const reservedByBottle = new Map<string, number>()
  for (const allocation of allocations) {
    const key = `${allocation.bottle_kind}:${allocation.bottle_id}`
    reservedByBottle.set(key, (reservedByBottle.get(key) || 0) + allocation.volume_ml)
  }

  const bottles: DecantBottleCapacity[] = [
    ...openBottles.map((bottle) => ({
      id: bottle.id,
      kind: "open" as const,
      freeMl: bottle.remaining_ml - (reservedByBottle.get(`open:${bottle.id}`) || 0),
    })),
    ...plannedBottles.map((bottle) => ({
      id: bottle.id,
      kind: "planned" as const,
      freeMl: bottle.usable_ml - (reservedByBottle.get(`planned:${bottle.id}`) || 0),
    })),
  ]

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product_variant",
    filters: { id: request.sourceVariantId },
    fields: [
      "id",
      "product_id",
      "title",
      "sku",
      "metadata",
      "manage_inventory",
      "inventory_items.inventory_item_id",
      "inventory_items.required_quantity",
      "inventory_items.inventory.location_levels.location_id",
      "inventory_items.inventory.location_levels.stocked_quantity",
      "inventory_items.inventory.location_levels.reserved_quantity",
      "inventory_items.inventory.location_levels.stock_locations.sales_channels.id",
    ],
  })
  const variant = data[0] as SourceVariant | undefined
  if (!variant || variant.product_id !== request.sourceProductId) {
    throw invalid("Избраната цяла разфасовка вече не принадлежи на този парфюм.")
  }
  const storedVolume = readBottleVolumeMl(variant)
  if (storedVolume !== request.sourceVolumeMl) {
    throw invalid("Обемът на цялата разфасовка е променен. Запазете отново настройката „Отливки“ в продукта.")
  }
  if (
    variant.manage_inventory === false ||
    variant.inventory_items?.length !== 1 ||
    Number(variant.inventory_items[0].required_quantity || 1) !== 1
  ) {
    throw invalid("За автоматични отливки цялата разфасовка трябва да има един складов артикул с количество 1.")
  }

  const inventoryItem = variant.inventory_items[0]
  const sealedSlots = (inventoryItem.inventory?.location_levels || [])
    .filter((level) => {
      return !salesChannelId || level.stock_locations?.some(
        (location) => location.sales_channels?.some(
          (channel) => channel.id === salesChannelId
        )
      ) === true
    })
    .map((level) => ({
      inventoryItemId: inventoryItem.inventory_item_id,
      locationId: level.location_id,
      availableUnits: Math.max(0, Math.floor(
        Number(level.stocked_quantity) - Number(level.reserved_quantity)
      )),
    }))

  return {
    bottles,
    sealedSlots,
    usableMl: request.sourceVolumeMl - DECANT_RESERVE_ML,
  }
}
