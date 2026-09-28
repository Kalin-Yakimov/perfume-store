import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { DECANT_STOCK_MODULE } from "../modules/decant-stock"
import { releaseDecantAllocations } from "../modules/decant-stock/reservation"
import DecantStockModuleService from "../modules/decant-stock/service"

export default async function releaseDecantsOnOrderCanceled({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const stock: DecantStockModuleService = container.resolve(DECANT_STOCK_MODULE)
  let allocations = await stock.listDecantAllocations({
    order_id: data.id,
    status: "reserved",
  })
  if (!allocations.length) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: links } = await query.graph({
      entity: "order_cart",
      filters: { order_id: data.id },
      fields: ["cart_id"],
    })
    if (links[0]?.cart_id) {
      allocations = await stock.listDecantAllocations({
        cart_id: links[0].cart_id,
        status: "reserved",
      })
    }
  }
  await releaseDecantAllocations(container, allocations.map((item) => item.id))
}

export const config: SubscriberConfig = { event: "order.canceled" }
