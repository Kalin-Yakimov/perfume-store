import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

import { canFulfillCartDecants } from "../../../../modules/decant-stock/cart-preview"
import type { PreviewCartItem } from "../../../../modules/decant-stock/cart-preview"
import type { ValidateDecantStockBody } from "./middlewares"

export async function POST(
  req: MedusaRequest<ValidateDecantStockBody>,
  res: MedusaResponse
) {
  const {
    cart_id: cartId,
    line_item_id: lineItemId,
    variant_id: variantId,
    quantity,
  } = req.validatedBody

  const cart = await req.scope.resolve(Modules.CART).retrieveCart(cartId, {
    relations: ["items"],
  })
  const items = (cart.items || []) as PreviewCartItem[]
  let proposedItems: PreviewCartItem[]

  if (lineItemId) {
    if (!items.some((item) => item.id === lineItemId)) {
      res.status(404).json({ message: "Артикулът не е намерен в кошницата." })
      return
    }
    proposedItems = items.map((item) =>
      item.id === lineItemId ? { ...item, quantity } : item
    )
  } else {
    const variants = await req.scope.resolve(Modules.PRODUCT).listProductVariants({
      id: [variantId!],
    })
    if (!variants[0]?.product_id) {
      res.status(404).json({ message: "Разфасовката не беше намерена." })
      return
    }
    proposedItems = [
      ...items,
      { product_id: variants[0].product_id, variant_id: variantId, quantity },
    ]
  }

  if (!(await canFulfillCartDecants(req.scope, proposedItems, cart.sales_channel_id))) {
    res.status(409).json({
      message:
        "Няма достатъчна наличност за избраните цели бутилки и отливки в кошницата.",
    })
    return
  }

  res.json({ valid: true })
}
