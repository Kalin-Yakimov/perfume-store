import "server-only"

import { listCartOptions } from "@lib/data/cart"
import { retrieveCartForRender } from "@lib/data/cart-read"
import { retrieveCustomerSummary } from "@lib/data/customer-read"
import FreeShippingPriceNudge from "@modules/shipping/components/free-shipping-price-nudge"
import CartMismatchBanner from "../cart-mismatch-banner"

export async function CartMismatchNotification() {
  const [customer, cart] = await Promise.all([
    retrieveCustomerSummary(),
    retrieveCartForRender().catch(() => null),
  ])

  return customer && cart ? (
    <CartMismatchBanner customer={customer} cart={cart} />
  ) : null
}

export async function CartShippingNudge() {
  const cart = await retrieveCartForRender().catch(() => null)
  if (!cart) return null

  const { shipping_options } = await listCartOptions(cart.id).catch(() => ({
    shipping_options: [],
  }))

  return (
    <FreeShippingPriceNudge
      variant="popup"
      cart={cart}
      shippingOptions={shipping_options}
    />
  )
}
