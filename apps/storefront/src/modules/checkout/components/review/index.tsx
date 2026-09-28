"use client"

import { Heading, Text, clx } from "@modules/common/components/ui"

import PaymentButton from "../payment-button"
import { useSearchParams } from "next/navigation"
import { HttpTypes } from "@medusajs/types"
import { isManual } from "@lib/constants"
import { needsDeliveryPoint, readDeliveryPoint } from "@lib/util/delivery-point"

const Review = ({ cart }: { cart: HttpTypes.StoreCart }) => {
  const searchParams = useSearchParams()

  const isOpen = searchParams.get("step") === "review"

  const paidByGiftcard = !!(
    (cart as unknown as Record<string, unknown>)?.gift_cards &&
    ((cart as unknown as Record<string, unknown>)?.gift_cards as unknown[])
      ?.length > 0 &&
    cart?.total === 0
  )

  const previousStepsCompleted =
    cart.shipping_address &&
    (cart.shipping_methods?.length ?? 0) > 0 &&
    (cart.payment_collection || paidByGiftcard)
  const shippingMethod = cart.shipping_methods?.at(-1)
  const point = readDeliveryPoint(cart.metadata?.delivery_point)
  const hasDeliveryPoint =
    !shippingMethod ||
    !needsDeliveryPoint(shippingMethod.name || "") ||
    point?.shippingOptionId === shippingMethod.shipping_option_id
  const deliveryName = shippingMethod?.name?.toLocaleLowerCase("bg-BG") || ""
  const isLocker =
    deliveryName.includes("автомат") ||
    deliveryName.includes("boxnow") ||
    deliveryName.includes("box now")
  const activePayment = cart.payment_collection?.payment_sessions?.find(
    (session) => session.status === "pending",
  )
  const paymentAllowed = !isLocker || !isManual(activePayment?.provider_id)

  return (
    <div>
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className={clx(
            "font-display flex items-center gap-2 text-2xl font-normal text-[#211d19]",
            {
              "opacity-50 pointer-events-none select-none": !isOpen,
            },
          )}
        >
          Преглед и потвърждение
        </Heading>
      </div>
      {isOpen &&
        previousStepsCompleted &&
        hasDeliveryPoint &&
        paymentAllowed && (
          <>
            <div className="flex items-start gap-x-1 w-full mb-6">
              <div className="w-full">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">
                  Проверете адреса, доставката и общата сума. С бутона „Потвърди
                  поръчката“ я изпращате за обработка.
                </Text>
              </div>
            </div>
            <PaymentButton cart={cart} data-testid="submit-order-button" />
          </>
        )}
      {isOpen &&
        (!previousStepsCompleted || !hasDeliveryPoint || !paymentAllowed) && (
          <p className="text-sm text-[#806e60]">
            Проверете избора на доставка, плащане и личните данни, преди да
            потвърдите поръчката.
          </p>
        )}
    </div>
  )
}

export default Review
