import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

import { canFulfillCartDecants } from "../../../../modules/decant-stock/cart-preview"
import type { PreviewCartItem } from "../../../../modules/decant-stock/cart-preview"

type ValidateBody = {
  cart_id?: string
  variant_id?: string
  quantity?: number
  line_item_id?: string
}

export async function POST(
  req: MedusaRequest<ValidateBody>,
  res: MedusaResponse
) {
  const cartId = req.body?.cart_id
  const lineItemId = req.body?.line_item_id
  const variantId = req.body?.variant_id
  const quantity = Number(req.body?.quantity)

  if (
    !cartId ||
    (!lineItemId && !variantId) ||
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    res.status(400).json({ message: "Невалидна заявка за наличност." })
    return
  }

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
