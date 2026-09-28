import { isStripeLike, paymentInfoMap } from "@lib/constants"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

type PaymentDetailsProps = {
  order: HttpTypes.StoreOrder
}

const PaymentDetails = ({ order }: PaymentDetailsProps) => {
  const payment = order.payment_collections?.[0]?.payments?.[0]
  const paymentInfo = payment ? paymentInfoMap[payment.provider_id] : undefined

  return (
    <section className="mt-8 border-t border-[#ded7cf] pt-8">
      <h2 className="font-display text-2xl text-[#211d19]">Плащане</h2>
      {payment ? (
        <div className="mt-5 grid gap-6 text-sm leading-6 text-[#62584f] xsmall:grid-cols-2">
          <div className="flex min-w-0 flex-col">
            <h3 className="mb-2 font-semibold text-[#211d19]">
              Начин на плащане
            </h3>
            <p data-testid="payment-method">
              {paymentInfo?.title || "Плащане"}
            </p>
          </div>
          <div className="flex min-w-0 flex-col">
            <h3 className="mb-2 font-semibold text-[#211d19]">
              Данни за плащането
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {paymentInfo?.icon && (
                <span className="flex h-7 items-center border border-[#ded7cf] bg-[#f8f3ed] px-2">
                  {paymentInfo.icon}
                </span>
              )}
              <p data-testid="payment-amount">
                {isStripeLike(payment.provider_id) && payment.data?.card_last4
                  ? `Карта •••• ${payment.data.card_last4}`
                  : `${convertToLocale({
                      amount: payment.amount,
                      currency_code: order.currency_code,
                    })} · ${payment.created_at ? new Intl.DateTimeFormat("bg-BG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(payment.created_at)) : "Плащането се обработва"}`}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[#62584f]">
          Информацията за плащането ще се появи след обработката му.
        </p>
      )}
    </section>
  )
}

export default PaymentDetails
