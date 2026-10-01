"use client"

import { Button, Heading } from "@modules/common/components/ui"

import CartTotals from "@modules/common/components/cart-totals"
import Divider from "@modules/common/components/divider"
import DiscountCode from "@modules/checkout/components/discount-code"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"

type SummaryProps = {
  cart: HttpTypes.StoreCart
}

function getCheckoutStep(cart: HttpTypes.StoreCart) {
  if (!cart.shipping_methods?.length) {
    return "delivery"
  }
  if (!cart.payment_collection?.payment_sessions?.some((session) => session.status === "pending")) {
    return "payment"
  }
  if (!cart.shipping_address?.first_name || !cart.email) {
    return "address"
  }
  return "review"
}

const Summary = ({ cart }: SummaryProps) => {
  const step = getCheckoutStep(cart)

  return (
    <div className="flex flex-col gap-y-4">
      <Heading
        level="h2"
        className="font-display text-3xl font-normal leading-tight text-[#211d19]"
      >
        Обобщение
      </Heading>
      <DiscountCode cart={cart} />
      <Divider />
      <CartTotals totals={cart} />
      <LocalizedClientLink
        href={"/checkout?step=" + step}
        data-testid="checkout-button"
      >
        <Button className="h-12 w-full rounded-none bg-[#211d19] text-xs font-semibold uppercase tracking-[0.16em] text-white hover:bg-[#40372f]">
          Към поръчката
        </Button>
      </LocalizedClientLink>
    </div>
  )
}

export default Summary
