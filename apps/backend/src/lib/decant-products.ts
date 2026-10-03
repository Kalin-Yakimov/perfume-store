import type { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { listLinkedDecants } from "./linked-decants"

export type DecantProductRecord = {
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
  }[]
}

export const decantProductFields = [
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
]

export async function readSourceAndDecant(
  container: MedusaContainer,
  sourceId: string,
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    filters: { id: sourceId },
    fields: decantProductFields,
  })
  const source = data[0] as DecantProductRecord | undefined
  if (!source || source.metadata?.listing_type === "decant") {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "Целият парфюм не беше намерен.",
    )
  }
  const linked = await listLinkedDecants(container, source.id)
  if (linked.length > 1) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Има повече от една свързана обява за отливки. Премахнете дублираната обява преди редакция.",
    )
  }
  let decant: DecantProductRecord | null = null
  if (linked[0]) {
    const { data: records } = await query.graph({
      entity: "product",
      filters: { id: linked[0].id },
      fields: decantProductFields,
    })
    decant = records[0] as DecantProductRecord
  }
  return { source, decant }
}

export function decantVariantIdsByVolume(
  variants: { id: string; title: string }[],
) {
  const result: Record<number, string> = {}
  for (const variant of variants) {
    const match = variant.title.match(/(\d+(?:[.,]\d+)?)\s*ml/i)
    const volume = match ? Number(match[1].replace(",", ".")) : 0
    if (![5, 10].includes(volume) || result[volume]) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Свързаната отливка няма коректните различни варианти 5 мл и 10 мл.",
      )
    }
    result[volume] = variant.id
  }
  if (!result[5] || !result[10]) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Свързаната отливка няма коректните различни варианти 5 мл и 10 мл.",
    )
  }
  return result
}
