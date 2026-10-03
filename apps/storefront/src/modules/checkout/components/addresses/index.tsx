"use client"

import { setAddresses } from "@lib/data/cart"
import { readDeliveryPoint } from "@lib/util/delivery-point"
import { HttpTypes } from "@medusajs/types"
import type { CustomerProfile } from "@lib/data/customer-types"
import ErrorMessage from "@modules/checkout/components/error-message"
import ShippingAddress from "@modules/checkout/components/shipping-address"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useActionState } from "react"

export default function Addresses({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: CustomerProfile | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isOpen = searchParams.get("step") === "address"
  const point = readDeliveryPoint(cart?.metadata?.delivery_point)
  const [message, formAction] = useActionState(setAddresses, null)

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#826c5a]">
            03 · Получател
          </p>
          <h2 className="font-display mt-2 text-2xl text-[#211d19]">
            Лични данни
          </h2>
        </div>
        {!isOpen && cart?.shipping_address?.first_name && (
          <button
            type="button"
            onClick={() =>
              router.push(`${pathname}?step=address`, { scroll: false })
            }
            className="text-sm font-medium text-[#806e60] underline underline-offset-4"
            data-testid="edit-address-button"
          >
            Редактирай
          </button>
        )}
      </div>

      {isOpen ? (
        <form action={formAction}>
          <p className="mb-5 text-sm leading-6 text-[#62584f]">
            Посочете човека, който ще получи поръчката. Не се изискват фирма или
            пощенски код.
          </p>
          <ShippingAddress customer={customer} cart={cart} point={point} />
          <SubmitButton className="mt-6" data-testid="submit-address-button">
            Продължи към преглед
          </SubmitButton>
          <ErrorMessage error={message} data-testid="address-error-message" />
        </form>
      ) : cart?.shipping_address?.first_name ? (
        <div className="text-sm leading-6 text-[#62584f]">
          <p className="font-medium text-[#211d19]">
            {cart.shipping_address.first_name} {cart.shipping_address.last_name}
          </p>
          <p>
            {cart.email} · {cart.shipping_address.phone}
          </p>
          <p>
            {cart.shipping_address.address_1}, {cart.shipping_address.city}
          </p>
        </div>
      ) : (
        <p className="text-sm text-[#806e60]">
          Попълнете данните след избора на доставка и плащане.
        </p>
      )}
    </div>
  )
}
