import ItemsPreviewTemplate from "@modules/cart/templates/preview"
import DiscountCode from "@modules/checkout/components/discount-code"
import CartTotals from "@modules/common/components/cart-totals"
import { HttpTypes } from "@medusajs/types"
import { paymentInfoMap } from "@lib/constants"
import { readDeliveryPoint } from "@lib/util/delivery-point"

const CheckoutSummary = ({ cart }: { cart: HttpTypes.StoreCart }) => {
  const shippingMethod = cart.shipping_methods?.at(-1)
  const point = readDeliveryPoint(cart.metadata?.delivery_point)
  const paymentSession = cart.payment_collection?.payment_sessions?.find(
    (session) => session.status === "pending",
  )

  return (
    <aside className="flex flex-col gap-6 border border-[#ded7cf] bg-white p-5 small:sticky small:top-8 small:self-start small:p-7">
      <div className="flex w-full flex-col">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#826c5a]">
          Преглед
        </p>
        <h2 className="font-display mt-2 border-b border-[#ded7cf] pb-5 text-2xl text-[#211d19]">
          Вашата кошница
        </h2>
        <ItemsPreviewTemplate cart={cart} />
        {(shippingMethod || paymentSession) && (
          <div className="mt-5 space-y-4 border-t border-[#ded7cf] pt-5 text-sm">
            {shippingMethod && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#826c5a]">
                  Доставка
                </p>
                <p className="mt-1 font-medium text-[#211d19]">
                  {shippingMethod.name}
                </p>
                {point && point.shippingOptionId ===
                  shippingMethod.shipping_option_id && (
                  <p className="mt-1 leading-5 text-[#62584f]">
                    {point.name}, {point.address}
                  </p>
                )}
              </div>
            )}
            {paymentSession && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#826c5a]">
                  Плащане
                </p>
                <p className="mt-1 font-medium text-[#211d19]">
                  {paymentInfoMap[paymentSession.provider_id]?.title ||
                    paymentSession.provider_id}
                </p>
              </div>
            )}
          </div>
        )}
        <div className="mt-6 border-t border-[#ded7cf] pt-5">
          <CartTotals totals={cart} />
        </div>
        <div className="mt-6 border-t border-[#ded7cf] pt-4">
          <DiscountCode cart={cart} />
        </div>
      </div>
    </aside>
  )
}

export default CheckoutSummary
