type OrderPreparationState = {
  status?: string | null
  canceled_at?: Date | string | null
}

export function isOrderCanceledForPreparation(order: OrderPreparationState) {
  return order.status === "canceled" || Boolean(order.canceled_at)
}
