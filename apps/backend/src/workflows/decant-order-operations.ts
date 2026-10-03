import type { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"

import { DECANT_STOCK_MODULE } from "../modules/decant-stock"
import {
  decantSourceLock,
  releaseDecantAllocations,
} from "../modules/decant-stock/reservation"
import DecantStockModuleService from "../modules/decant-stock/service"
import { isOrderCanceledForPreparation } from "./order-preparation"

const orderLock = (orderId: string) => `decant-order:${orderId}`

export async function retrieveDecantOrder(
  container: MedusaContainer,
  orderId: string,
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph(
    {
      entity: "order",
      fields: ["id", "status", "canceled_at"],
      filters: { id: orderId },
    },
    { throwIfKeyNotFound: true },
  )
  return data[0]
}

async function retrieveCartId(container: MedusaContainer, orderId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order_cart",
    filters: { order_id: orderId },
    fields: ["cart_id"],
  })
  return data[0]?.cart_id
}

/** Read the order's linked and not-yet-linked cart allocations without writes.
 * The order/cart link and order.placed event may be processed in either order. */
export async function readDecantAllocationsForOrder(
  container: MedusaContainer,
  orderId: string,
) {
  const stock: DecantStockModuleService = container.resolve(DECANT_STOCK_MODULE)
  const cartId = await retrieveCartId(container, orderId)
  const linked = await stock.listDecantAllocations({ order_id: orderId })
  const cart = cartId
    ? await stock.listDecantAllocations({ cart_id: cartId })
    : []
  const byId = new Map(linked.map((allocation) => [allocation.id, allocation]))
  for (const allocation of cart) {
    if (!allocation.order_id || allocation.order_id === orderId) {
      byId.set(allocation.id, allocation)
    }
  }
  return [...byId.values()]
}

/** Reconcile the derived order id under the same locks used by preparation. */
export async function linkDecantAllocationsForOrder(
  container: MedusaContainer,
  orderId: string,
) {
  const order = await retrieveDecantOrder(container, orderId)
  if (isOrderCanceledForPreparation(order)) return
  const cartId = await retrieveCartId(container, orderId)
  if (!cartId) return
  const stock: DecantStockModuleService = container.resolve(DECANT_STOCK_MODULE)
  const pending = await stock.listDecantAllocations({
    cart_id: cartId,
    status: "reserved",
  })
  if (!pending.length) return
  const locking = container.resolve(Modules.LOCKING)
  const keys = [
    orderLock(orderId),
    ...new Set(
      pending.map((allocation) =>
        decantSourceLock(allocation.source_product_id),
      ),
    ),
  ].sort()
  await locking.execute(
    keys,
    async () => {
      // A cancellation may have committed while this event waited for its lock.
      const currentOrder = await retrieveDecantOrder(container, orderId)
      if (isOrderCanceledForPreparation(currentOrder)) return
      const current = await stock.listDecantAllocations({
        cart_id: cartId,
        status: "reserved",
      })
      if (
        current.some(
          (allocation) =>
            allocation.order_id && allocation.order_id !== orderId,
        )
      ) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Отливка от количката вече е свързана с друга поръчка.",
        )
      }
      const updates = current
        .filter((allocation) => !allocation.order_id)
        .map((allocation) => ({ id: allocation.id, order_id: orderId }))
      // One module transaction: a conflict/failure cannot leave a partly linked cart.
      if (updates.length) await stock.updateDecantAllocations(updates)
    },
    { timeout: 30 },
  )
}

export async function releaseDecantAllocationsForOrder(
  container: MedusaContainer,
  orderId: string,
) {
  const locking = container.resolve(Modules.LOCKING)
  await locking.execute(
    orderLock(orderId),
    async () => {
      const order = await retrieveDecantOrder(container, orderId)
      if (!isOrderCanceledForPreparation(order)) return
      // Include released rows so retries repair cleanup left by older partial runs.
      const allocations = await readDecantAllocationsForOrder(
        container,
        orderId,
      )
      await releaseDecantAllocations(
        container,
        allocations
          .filter((allocation) => allocation.status !== "prepared")
          .map((allocation) => allocation.id),
      )
    },
    { timeout: 30 },
  )
}
