import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { DECANT_STOCK_MODULE } from "../modules/decant-stock"
import DecantStockModuleService from "../modules/decant-stock/service"

/** Checkout already reserved each vial. Order placement only attaches the
 * order id; physical millilitres are deducted when staff prepares it. */
export default async function linkDecantsToOrder({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: links } = await query.graph({
    entity: "order_cart",
    filters: { order_id: data.id },
    fields: ["cart_id", "order_id"],
  })
  const cartId = links[0]?.cart_id
  if (!cartId) {
    // The core workflow emits this event alongside creation of the link.
    // The admin order flow and cancellation handler reconcile by cart later.
    return
  }

  const stock: DecantStockModuleService = container.resolve(DECANT_STOCK_MODULE)
  const allocations = await stock.listDecantAllocations({
    cart_id: cartId,
    status: "reserved",
  })
  for (const allocation of allocations) {
    if (allocation.order_id === data.id) continue
    await stock.updateDecantAllocations({
      id: allocation.id,
      order_id: data.id,
    })
  }
}

export const config: SubscriberConfig = { event: "order.placed" }
