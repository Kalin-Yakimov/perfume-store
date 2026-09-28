import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

type ShippingDetailsProps = {
  order: HttpTypes.StoreOrder
}

const ShippingDetails = ({ order }: ShippingDetailsProps) => {
  const countryCode = order.shipping_address?.country_code
  const countryName = countryCode
    ? new Intl.DisplayNames(["bg"], { type: "region" }).of(
        countryCode.toUpperCase(),
      ) || countryCode.toUpperCase()
    : null

  return (
    <section className="mt-8 border-t border-[#ded7cf] pt-8">
      <h2 className="font-display text-2xl text-[#211d19]">Доставка</h2>
      <div className="mt-5 grid gap-6 text-sm leading-6 text-[#62584f] xsmall:grid-cols-2 small:grid-cols-3">
        <div
          className="flex min-w-0 flex-col"
          data-testid="shipping-address-summary"
        >
          <h3 className="mb-2 font-semibold text-[#211d19]">
            Адрес за доставка
          </h3>
          <p>
            {order.shipping_address?.first_name}{" "}
            {order.shipping_address?.last_name}
          </p>
          <p>
            {order.shipping_address?.address_1}{" "}
            {order.shipping_address?.address_2}
          </p>
          <p>
            {order.shipping_address?.postal_code},{" "}
            {order.shipping_address?.city}
          </p>
          {countryName && <p>{countryName}</p>}
        </div>
        <div
          className="flex min-w-0 flex-col"
          data-testid="shipping-contact-summary"
        >
          <h3 className="mb-2 font-semibold text-[#211d19]">Контакт</h3>
          {order.shipping_address?.phone && (
            <p>{order.shipping_address.phone}</p>
          )}
          <p className="break-all">{order.email}</p>
        </div>
        <div
          className="flex min-w-0 flex-col"
          data-testid="shipping-method-summary"
        >
          <h3 className="mb-2 font-semibold text-[#211d19]">
            Начин на доставка
          </h3>
          {order.shipping_methods?.[0] ? (
            <p>
              {(order.shipping_methods[0] as { name?: string }).name ||
                "Избрана доставка"}{" "}
              ·{" "}
              {convertToLocale({
                amount: order.shipping_methods[0].total ?? 0,
                currency_code: order.currency_code,
              })}
            </p>
          ) : (
            <p>Информацията за доставката се обработва.</p>
          )}
        </div>
      </div>
    </section>
  )
}

export default ShippingDetails
