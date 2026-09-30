import type { MedusaContainer } from "@medusajs/framework"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"

import { DECANT_RESERVE_ML, DECANT_STOCK_MODULE } from "../modules/decant-stock"
import DecantStockModuleService from "../modules/decant-stock/service"
import { groupDecantAllocationsByBottle } from "./decant-order-allocation"
import { isOrderCanceledForPreparation } from "./order-preparation"

type PrepareDecantOrderInput = { order_id: string }

type PreparationResult = {
  prepared_vials: number
  opened_bottles: number
}

type InventoryService = {
  listReservationItems: (filter: { id: string }) => Promise<{
    id: string
    inventory_item_id: string
    location_id: string
    quantity: unknown
  }[]>
  softDeleteReservationItems: (ids: string[]) => Promise<unknown>
  restoreReservationItems: (ids: string[]) => Promise<unknown>
  adjustInventory: (itemId: string, locationId: string, amount: number) => Promise<unknown>
}

type LockingService = {
  execute: <T>(keys: string[], operation: () => Promise<T>, options?: { timeout: number }) => Promise<T>
}

const roundMl = (value: number) => Math.round(value * 100) / 100
const invalid = (message: string) => new MedusaError(MedusaError.Types.INVALID_DATA, message)

async function retrieveOrderForPreparation(container: MedusaContainer, orderId: string) {
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

/** Order/cart linking and order.placed subscribers can run in either order.
 * Reconcile the link when staff first opens or prepares the order. */
export async function linkDecantAllocationsForOrder(
  container: MedusaContainer,
  orderId: string
) {
  const stock: DecantStockModuleService = container.resolve(DECANT_STOCK_MODULE)
  const order = await retrieveOrderForPreparation(container, orderId)
  if (isOrderCanceledForPreparation(order)) return

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: links } = await query.graph({
    entity: "order_cart",
    filters: { order_id: orderId },
    fields: ["cart_id"],
  })
  const cartId = links[0]?.cart_id
  if (!cartId) return

  const pending = await stock.listDecantAllocations({ cart_id: cartId, status: "reserved" })
  const unlinked = pending.filter((allocation) => !allocation.order_id)
  if (!unlinked.length) return

  const locking: LockingService = container.resolve(Modules.LOCKING)
  const keys = [
    `decant-order:${orderId}`,
    ...new Set(unlinked.map((allocation) => `decant-stock:${allocation.source_product_id}`)),
  ].sort()
  await locking.execute(keys, async () => {
    const current = await stock.listDecantAllocations({ cart_id: cartId, status: "reserved" })
    for (const allocation of current) {
      if (allocation.order_id && allocation.order_id !== orderId) {
        throw invalid("Отливка от количката вече е свързана с друга поръчка.")
      }
      if (allocation.order_id) continue
      await stock.updateDecantAllocations({ id: allocation.id, order_id: orderId })
    }
  }, { timeout: 30 })
}

const prepareDecantOrderStep = createStep(
  "prepare-decant-order",
  async ({ order_id }: PrepareDecantOrderInput, { container }) => {
    const decantStock: DecantStockModuleService = container.resolve(DECANT_STOCK_MODULE)
    const inventory: InventoryService = container.resolve(Modules.INVENTORY)
    const locking: LockingService = container.resolve(Modules.LOCKING)
    const order = await retrieveOrderForPreparation(container, order_id)
    if (isOrderCanceledForPreparation(order)) {
      throw invalid("Отказана поръчка не може да бъде приготвена.")
    }

    await linkDecantAllocationsForOrder(container, order_id)

    const pending = await decantStock.listDecantAllocations({
      order_id,
      status: "reserved",
    })
    if (!pending.length) {
      return new StepResponse<PreparationResult>({ prepared_vials: 0, opened_bottles: 0 })
    }

    const plannedIds = [...new Set(pending.filter((item) => item.bottle_kind === "planned").map((item) => item.bottle_id))]
    const plannedBefore = plannedIds.length
      ? await decantStock.listDecantPlannedBottles({ id: plannedIds })
      : []
    const lockKeys = [
      `decant-order:${order_id}`,
      ...new Set(pending.map((item) => `decant-stock:${item.source_product_id}`)),
      ...new Set(plannedBefore.map((item) => item.inventory_item_id)),
    ].sort()

    const result = await locking.execute(lockKeys, async () => {
      const currentOrder = await retrieveOrderForPreparation(container, order_id)
      if (isOrderCanceledForPreparation(currentOrder)) {
        throw invalid("Отказана поръчка не може да бъде приготвена.")
      }
      const allocations = await decantStock.listDecantAllocations({
        order_id,
        status: "reserved",
      })
      if (!allocations.length) {
        return { prepared_vials: 0, opened_bottles: 0 }
      }

      const activePlanIds = [...new Set(allocations.filter((item) => item.bottle_kind === "planned").map((item) => item.bottle_id))]
      const plans = activePlanIds.length
        ? await decantStock.listDecantPlannedBottles({ id: activePlanIds })
        : []
      const plansById = new Map(plans.map((plan) => [plan.id, plan]))
      const reservationsByPlan = new Map<string, { id: string }>()

      if (activePlanIds.some((id) => !plansById.has(id))) {
        throw invalid("Липсва заделена бутилка за част от поръчката.")
      }

      for (const plan of plans) {
        if (plan.status === "released") {
          throw invalid("Заделена бутилка е освободена. Проверете поръчката и наличността.")
        }
        if (plan.status === "opened") {
          if (!plan.opened_bottle_id) {
            throw invalid("Отворената бутилка няма складов запис. Нужна е ръчна проверка.")
          }
          continue
        }
        if (plan.opened_bottle_id) {
          throw invalid("Отварянето на бутилка е незавършено. Нужна е ръчна проверка.")
        }
        if (!Number.isFinite(plan.usable_ml) || plan.usable_ml <= 0) {
          throw invalid("Заделената бутилка има невалиден използваем обем.")
        }
        const [reservation] = await inventory.listReservationItems({ id: plan.reservation_id })
        if (
          !reservation ||
          reservation.inventory_item_id !== plan.inventory_item_id ||
          reservation.location_id !== plan.location_id ||
          Number(reservation.quantity) !== 1
        ) {
          throw invalid("Заделената цяла бутилка не съвпада със складовата резервация.")
        }
        reservationsByPlan.set(plan.id, reservation)
      }

      const undo: (() => Promise<unknown>)[] = []
      const bottleIdsByPlan = new Map<string, string>()
      let openedBottles = 0

      try {
        for (const plan of plans) {
          let openedBottleId: string
          if (plan.status === "opened") {
            openedBottleId = plan.opened_bottle_id!
          } else {
            const bottle = await decantStock.createDecantBottles({
              source_product_id: plan.source_product_id,
              source_variant_id: plan.source_variant_id,
              source_volume_ml: plan.source_volume_ml,
              reserve_ml: DECANT_RESERVE_ML,
              initial_ml: plan.usable_ml,
              remaining_ml: plan.usable_ml,
              status: "active",
              opened_at: new Date(),
            })
            undo.push(() => decantStock.deleteDecantBottles(bottle.id))

            const reservation = reservationsByPlan.get(plan.id)!
            await inventory.softDeleteReservationItems([reservation.id])
            undo.push(() => inventory.restoreReservationItems([reservation.id]))
            await inventory.adjustInventory(plan.inventory_item_id, plan.location_id, -1)
            undo.push(() => inventory.adjustInventory(plan.inventory_item_id, plan.location_id, 1))

            await decantStock.updateDecantPlannedBottles({
              id: plan.id,
              status: "opened",
              opened_bottle_id: bottle.id,
            })
            undo.push(() => decantStock.updateDecantPlannedBottles({
              id: plan.id,
              status: "planned",
              opened_bottle_id: null,
            }))
            openedBottleId = bottle.id
            openedBottles++
          }

          const assigned = await decantStock.listDecantAllocations({
            bottle_kind: "planned",
            bottle_id: plan.id,
            status: "reserved",
          })
          for (const allocation of assigned) {
            await decantStock.updateDecantAllocations({
              id: allocation.id,
              bottle_kind: "open",
              bottle_id: openedBottleId,
            })
            undo.push(() => decantStock.updateDecantAllocations({
              id: allocation.id,
              bottle_kind: "planned",
              bottle_id: plan.id,
            }))
          }

          bottleIdsByPlan.set(plan.id, openedBottleId)
        }

        const resolvedAllocations: {
          id: string
          bottle_id: string
          bottle_kind: string
          volume_ml: number
        }[] = []
        for (const allocation of allocations) {
          const bottleId = allocation.bottle_kind === "planned"
            ? bottleIdsByPlan.get(allocation.bottle_id)
            : allocation.bottle_id
          if (!bottleId) {
            throw invalid("Липсва бутилка за една от отливките.")
          }
          resolvedAllocations.push({
            id: allocation.id,
            bottle_id: bottleId,
            bottle_kind: "open",
            volume_ml: allocation.volume_ml,
          })
        }

        const vialsByBottle = groupDecantAllocationsByBottle(resolvedAllocations)
        if (!vialsByBottle) {
          throw invalid("Поръчката съдържа отливка с невалиден обем.")
        }

        for (const group of vialsByBottle) {
          const bottleId = group.bottle_id
          const existingAdjustments = await decantStock.listDecantAdjustments({
            bottle_id: bottleId,
            order_id,
          })
          if (existingAdjustments.length) {
            throw invalid("Тази поръчка вече има отчетено приспадане от бутилката. Нужна е ръчна проверка.")
          }
          const [bottle] = await decantStock.listDecantBottles({ id: bottleId })
          if (!bottle) {
            throw invalid("Липсва отворената бутилка за отливка от поръчката.")
          }
          const remainingMl = roundMl(bottle.remaining_ml - group.volume_ml)
          if (remainingMl < 0) {
            throw invalid("Недостатъчен остатък в заделената бутилка.")
          }
          const otherReservations = await decantStock.listDecantAllocations({
            bottle_kind: "open",
            bottle_id: bottleId,
            status: "reserved",
          })
          const currentAllocationIds = new Set(group.allocation_ids)
          const otherReservedMl = roundMl(otherReservations.reduce(
            (total, allocation) =>
              total + (currentAllocationIds.has(allocation.id) ? 0 : allocation.volume_ml),
            0
          ))
          if (remainingMl < otherReservedMl) {
            throw invalid("Остатъкът няма да стигне за другите заделени отливки от тази бутилка.")
          }
          await decantStock.updateDecantBottles({
            id: bottleId,
            remaining_ml: remainingMl,
            status: remainingMl === 0 ? "depleted" : "active",
            closed_at: remainingMl === 0 ? new Date() : null,
          })
          undo.push(() => decantStock.updateDecantBottles({
            id: bottleId,
            remaining_ml: bottle.remaining_ml,
            status: bottle.status,
            closed_at: bottle.closed_at,
          }))

          const adjustment = await decantStock.createDecantAdjustments({
            bottle_id: bottleId,
            order_id,
            change_ml: -group.volume_ml,
            reason: "sale",
            note: `Приготвена поръчка ${order_id}`,
          })
          undo.push(() => decantStock.deleteDecantAdjustments(adjustment.id))

          for (const allocationId of group.allocation_ids) {
            await decantStock.updateDecantAllocations({ id: allocationId, status: "prepared" })
            undo.push(() => decantStock.updateDecantAllocations({ id: allocationId, status: "reserved" }))
          }
        }

        return {
          prepared_vials: allocations.length,
          opened_bottles: openedBottles,
        }
      } catch (error) {
        const rollbackErrors: unknown[] = []
        for (const revert of undo.reverse()) {
          try {
            await revert()
          } catch (rollbackError) {
            rollbackErrors.push(rollbackError)
          }
        }
        if (rollbackErrors.length) {
          throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Подготовката не завърши и възстановяването е непълно. Нужна е ръчна проверка.")
        }
        throw error
      }
    }, { timeout: 30 })
    return new StepResponse<PreparationResult>(result)
  }
)

export const prepareDecantOrderWorkflow = createWorkflow(
  "prepare-decant-order",
  (input: PrepareDecantOrderInput) => {
    const result = prepareDecantOrderStep(input)
    return new WorkflowResponse(result)
  }
)
