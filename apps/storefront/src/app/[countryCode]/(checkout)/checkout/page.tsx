import { retrieveCartForRender } from "@lib/data/cart-read"
import { retrieveCustomer } from "@lib/data/customer"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Завършване на поръчката",
}

export default async function Checkout({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  if (countryCode !== "bg") {
    redirect("/zavarshvane-na-porachka?step=delivery")
  }

  const [cart, customer] = await Promise.all([
    retrieveCartForRender(),
    retrieveCustomer(),
  ])

  if (!cart) {
    redirect("/koshnitsa")
  }

  return (
    <div className="checkout-shell flex flex-col">
      <section className="border-b border-[#ded7cf] bg-[#eee8df] py-7 small:py-8">
        <div className="content-container max-w-6xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#826c5a]">
            Вашата поръчка
          </p>
          <h1 className="font-display mt-1 text-3xl tracking-[-0.02em] small:text-4xl">
            Завършване на поръчката
          </h1>
        </div>
      </section>
      <div className="content-container grid max-w-6xl grid-cols-1 gap-8 py-8 small:grid-cols-[minmax(0,1fr)_330px] small:gap-10 small:py-12">
        <PaymentWrapper cart={cart}>
          <CheckoutForm cart={cart} customer={customer} />
        </PaymentWrapper>
        <CheckoutSummary cart={cart} />
      </div>
    </div>
  )
}
