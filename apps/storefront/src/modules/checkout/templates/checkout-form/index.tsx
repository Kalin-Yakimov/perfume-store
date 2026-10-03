import { listCartShippingMethods } from "@lib/data/fulfillment"
import { listCartPaymentMethods } from "@lib/data/payment"
import { HttpTypes } from "@medusajs/types"
import type { CustomerProfile } from "@lib/data/customer-types"
import Addresses from "@modules/checkout/components/addresses"
import Payment from "@modules/checkout/components/payment"
import Review from "@modules/checkout/components/review"
import Shipping from "@modules/checkout/components/shipping"

export default async function CheckoutForm({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: CustomerProfile | null
}) {
  if (!cart) {
    return null
  }

  const shippingMethods = await listCartShippingMethods(cart.id)
  const paymentMethods = await listCartPaymentMethods(cart.region?.id ?? "")

  if (!shippingMethods || !paymentMethods) {
    return null
  }

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-4">
      <section className="checkout-step border border-[#ded7cf] bg-white p-5 small:p-7">
        <Shipping cart={cart} availableShippingMethods={shippingMethods} />
      </section>
      <section className="checkout-step border border-[#ded7cf] bg-white p-5 small:p-7">
        <Payment cart={cart} availablePaymentMethods={paymentMethods} />
      </section>
      <section className="checkout-step border border-[#ded7cf] bg-white p-5 small:p-7">
        <Addresses cart={cart} customer={customer} />
      </section>
      <section className="checkout-step border border-[#ded7cf] bg-white p-5 small:p-7">
        <Review cart={cart} />
      </section>
    </div>
  )
}
