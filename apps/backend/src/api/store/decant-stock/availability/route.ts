import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { maxAdditionalDecantQuantity } from "../../../../modules/decant-stock/cart-preview"
import type { PreviewCartItem } from "../../../../modules/decant-stock/cart-preview"
import { decantAvailabilityQuerySchema } from "./query-schema"

type DecantProduct = {
  id: string
  status: string
  metadata?: Record<string, unknown> | null
  variants?: { id: string }[]
  sales_channels?: { id: string }[]
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const parsed = decantAvailabilityQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      message: "Посочете от 1 до 200 отливки с валидни идентификатори.",
    })
    return
  }
  const { product_id: productIds, cart_id: cartId } = parsed.data

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    filters: { id: productIds },
    fields: ["id", "status", "metadata", "variants.id", "sales_channels.id"],
    pagination: { take: productIds.length, skip: 0 },
  })
  const products = data as DecantProduct[]
  if (!products.length) {
    res.status(404).json({ message: "Отливката не беше намерена." })
    return
  }

  const availability: Record<string, boolean> = {}
  const maxQuantity: Record<string, number> = {}
  const productAvailability: Record<string, boolean> = {}

  const cart =
    typeof cartId === "string" && cartId
      ? await req.scope.resolve(Modules.CART).retrieveCart(cartId, {
          relations: ["items"],
        })
      : null
  const cartItems = (cart?.items || []) as PreviewCartItem[]
  const checks = products.flatMap((product) => {
    if (product.metadata?.listing_type !== "decant") return []

    const variants = product.variants || []
    const enabledIds = Array.isArray(
      product.metadata.decant_enabled_variant_ids,
    )
      ? product.metadata.decant_enabled_variant_ids.filter(
          (id): id is string => typeof id === "string",
        )
      : []
    const listed =
      product.status === "published" &&
      product.metadata.decant_enabled === true &&
      product.metadata.catalog_visible === true
    const salesChannelId =
      cart?.sales_channel_id || product.sales_channels?.[0]?.id

    if (!listed || !salesChannelId) {
      for (const variant of variants) {
        availability[variant.id] = false
        maxQuantity[variant.id] = 0
      }
      productAvailability[product.id] = false
      return []
    }

    return variants.map((variant) => ({
      product,
      variant,
      enabledIds,
      salesChannelId,
    }))
  })

  // Keep the catalog request bounded while checking real decant stock across
  // multiple products in one storefront request.
  for (let offset = 0; offset < checks.length; offset += 6) {
    const chunk = checks.slice(offset, offset + 6)
    await Promise.all(
      chunk.map(async ({ product, variant, enabledIds, salesChannelId }) => {
        if (!enabledIds.includes(variant.id)) {
          availability[variant.id] = false
          maxQuantity[variant.id] = 0
          return
        }
        maxQuantity[variant.id] = await maxAdditionalDecantQuantity(
          req.scope,
          cartItems,
          product.id,
          variant.id,
          salesChannelId,
        )
        availability[variant.id] = maxQuantity[variant.id] > 0
      }),
    )
  }

  for (const product of products) {
    if (product.metadata?.listing_type !== "decant") continue
    productAvailability[product.id] = (product.variants || []).some(
      (variant) => availability[variant.id] === true,
    )
  }

  if (productIds.length === 1) {
    const product = products[0]
    if (!product || product.metadata?.listing_type !== "decant") {
      res.status(404).json({ message: "Отливката не беше намерена." })
      return
    }
  }

  res.setHeader("Cache-Control", "no-store")
  res.json({
    availability,
    max_quantity: maxQuantity,
    product_availability: productAvailability,
  })
}
