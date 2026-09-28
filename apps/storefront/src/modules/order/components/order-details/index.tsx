import { HttpTypes } from "@medusajs/types"

type OrderDetailsProps = {
  order: HttpTypes.StoreOrder
  showStatus?: boolean
}

const OrderDetails = ({ order, showStatus }: OrderDetailsProps) => {
  const statuses: Record<string, string> = {
    not_fulfilled: "Очаква изпълнение",
    partially_fulfilled: "Частично изпълнена",
    fulfilled: "Изпълнена",
    partially_shipped: "Частично изпратена",
    shipped: "Изпратена",
    partially_delivered: "Частично доставена",
    delivered: "Доставена",
    canceled: "Отказана",
    not_paid: "Неплатена",
    awaiting: "Очаква плащане",
    authorized: "Потвърдено плащане",
    captured: "Платена",
    partially_refunded: "Частично възстановена",
    refunded: "Възстановена",
    requires_action: "Изисква действие",
  }
  const formatStatus = (status: string) =>
    statuses[status] || status.split("_").join(" ")

  return (
    <div className="border border-[#e3d9cf] bg-[#f8f3ed] p-5 small:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#826c5a]">
        Потвърждение
      </p>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl text-[#211d19]">
          Поръчка № <span data-testid="order-id">{order.display_id}</span>
        </h2>
        <time
          data-testid="order-date"
          className="text-sm text-[#62584f]"
          dateTime={new Date(order.created_at).toISOString()}
        >
          {new Intl.DateTimeFormat("bg-BG", { dateStyle: "long" }).format(
            new Date(order.created_at),
          )}
        </time>
      </div>
      <p className="mt-4 text-sm leading-6 text-[#62584f]">
        Поръчката е регистрирана с имейл{" "}
        <strong
          className="font-semibold text-[#211d19]"
          data-testid="order-email"
        >
          {order.email}
        </strong>
        .
      </p>
      {showStatus && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#ded7cf] pt-4 text-sm text-[#62584f]">
          <p>
            Състояние на поръчката:{" "}
            <span
              className="font-medium text-[#211d19]"
              data-testid="order-status"
            >
              {formatStatus(order.fulfillment_status)}
            </span>
          </p>
          <p>
            Плащане:{" "}
            <span
              className="font-medium text-[#211d19]"
              data-testid="order-payment-status"
            >
              {formatStatus(order.payment_status)}
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

export default OrderDetails
