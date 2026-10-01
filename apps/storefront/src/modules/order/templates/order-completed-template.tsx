import { cookies as nextCookies } from "next/headers"

import CartTotals from "@modules/common/components/cart-totals"
import Help from "@modules/order/components/help"
import Items from "@modules/order/components/items"
import OnboardingCta from "@modules/order/components/onboarding-cta"
import OrderDetails from "@modules/order/components/order-details"
import ShippingDetails from "@modules/order/components/shipping-details"
import PaymentDetails from "@modules/order/components/payment-details"
import { HttpTypes } from "@medusajs/types"

type OrderCompletedTemplateProps = {
  order: HttpTypes.StoreOrder
}

export default async function OrderCompletedTemplate({
  order,
}: OrderCompletedTemplateProps) {
  const cookies = await nextCookies()

  const isOnboarding = cookies.get("_medusa_onboarding")?.value === "true"

  return (
    <div className="flex min-h-[60vh] flex-col bg-[#fbf9f6]">
      <section className="border-b border-[#ded7cf] bg-[#eee8df] py-8 small:py-10">
        <div className="content-container max-w-5xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#826c5a]">
            Благодарим ви
          </p>
          <h1 className="font-display mt-2 text-3xl leading-tight tracking-[-0.02em] text-[#211d19] small:text-4xl">
            Поръчката е приета
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#62584f]">
            Можете да прегледате продуктите и данните за доставка по-долу.
          </p>
        </div>
      </section>
      <div className="content-container flex max-w-5xl flex-col gap-6 py-8 small:py-12">
        {isOnboarding && <OnboardingCta orderId={order.id} />}
        <div
          className="w-full border border-[#ded7cf] bg-white p-5 small:p-9"
          data-testid="order-complete-container"
        >
          <OrderDetails order={order} />
          <section className="mt-8 border-t border-[#ded7cf] pt-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#826c5a]">
              Вашата селекция
            </p>
            <h2 className="font-display mt-2 text-2xl text-[#211d19]">
              Продукти в поръчката
            </h2>
            <Items order={order} />
            <div className="ml-auto mt-5 w-full max-w-sm">
              <CartTotals totals={order} />
            </div>
          </section>
          <ShippingDetails order={order} />
          <PaymentDetails order={order} />
          <Help />
        </div>
      </div>
    </div>
  )
}
