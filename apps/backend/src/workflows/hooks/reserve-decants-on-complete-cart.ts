import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"

import { DECANT_STOCK_MODULE } from "../../modules/decant-stock"
import {
  releaseDecantAllocations,
  reserveDecantSource,
} from "../../modules/decant-stock/reservation"
import DecantStockModuleService from "../../modules/decant-stock/service"
import { readDecantRequests } from "../../modules/decant-stock/stock"

completeCartWorkflow.hooks.validate(
  async ({ cart }, { container }) => {
    const requests = await readDecantRequests(container, cart.items || [])
    if (!requests.length) return new StepResponse(undefined, { allocationIds: [] })

    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: existingOrders } = await query.graph({
      entity: "order_cart",
      filters: { cart_id: cart.id },
      fields: ["order_id"],
    })
    if (existingOrders.length) {
      return new StepResponse(undefined, { allocationIds: [] })
    }

    const stock: DecantStockModuleService = container.resolve(DECANT_STOCK_MODULE)
    const previous = await stock.listDecantAllocations({
      cart_id: cart.id,
      status: "reserved",
    })
    if (previous.length) {
      await releaseDecantAllocations(container, previous.map((item) => item.id))
    }

    const allocationIds: string[] = []
    try {
      for (const request of requests) {
        const ids = await reserveDecantSource(
          container,
          cart.id,
          request,
          cart.sales_channel_id
        )
        allocationIds.push(...ids)
      }
      return new StepResponse(undefined, { allocationIds })
    } catch (error) {
      await releaseDecantAllocations(container, allocationIds)
      throw error
    }
  },
  async (compensation, { container }) => {
    await releaseDecantAllocations(container, compensation?.allocationIds || [])
  }
)
