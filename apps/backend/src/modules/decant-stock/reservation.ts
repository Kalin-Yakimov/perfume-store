import type { MedusaContainer } from "@medusajs/framework"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  createReservationsWorkflow,
  deleteReservationsWorkflow,
} from "@medusajs/medusa/core-flows"

import { DECANT_STOCK_MODULE } from "."
import { packDecants } from "./packing"
import DecantStockModuleService from "./service"
import { readStockSnapshot, SourceRequest } from "./stock"

export const decantSourceLock = (sourceProductId: string) =>
  `decant-stock:${sourceProductId}`

const notEnoughStock = () =>
  new MedusaError(
    MedusaError.Types.INVALID_DATA,
    "Няма достатъчно налични парфюми за избраните отливки. Намалете количеството или опитайте по-късно.",
  )

export async function reserveDecantSource(
  container: MedusaContainer,
  cartId: string,
  request: SourceRequest,
  salesChannelId?: string | null,
): Promise<string[]> {
  const locking = container.resolve(Modules.LOCKING)
  return locking.execute(
    decantSourceLock(request.sourceProductId),
    async () => {
      const stock: DecantStockModuleService =
        container.resolve(DECANT_STOCK_MODULE)
      const snapshot = await readStockSnapshot(
        container,
        request,
        salesChannelId,
      )
      const plan = packDecants(
        request.units,
        snapshot.bottles,
        snapshot.sealedSlots,
        snapshot.usableMl,
      )
      if (!plan) throw notEnoughStock()

      let reservationIds: string[] = []
      let plannedIds: string[] = []
      let allocationIds: string[] = []
      try {
        const reservations = plan.newBottles.length
          ? (
              await createReservationsWorkflow(container).run({
                input: {
                  reservations: plan.newBottles.map((bottle) => ({
                    inventory_item_id: bottle.inventoryItemId,
                    location_id: bottle.locationId,
                    quantity: 1,
                    created_by: "decant-checkout",
                    description: `Бутилка за отливки от количка ${cartId}`,
                    metadata: {
                      decant_cart_id: cartId,
                      source_product_id: request.sourceProductId,
                    },
                  })),
                },
              })
            ).result
          : []
        reservationIds = reservations.map((reservation) => reservation.id)

        const newBottleIds = new Map<string, string>()
        for (let index = 0; index < plan.newBottles.length; index++) {
          const planned = await stock.createDecantPlannedBottles({
            source_product_id: request.sourceProductId,
            source_variant_id: request.sourceVariantId,
            source_volume_ml: request.sourceVolumeMl,
            usable_ml: snapshot.usableMl,
            inventory_item_id: plan.newBottles[index].inventoryItemId,
            location_id: plan.newBottles[index].locationId,
            reservation_id: reservations[index].id,
          })
          plannedIds.push(planned.id)
          newBottleIds.set(plan.newBottles[index].id, planned.id)
        }

        for (const assignment of plan.assignments) {
          const allocation = await stock.createDecantAllocations({
            cart_id: cartId,
            source_product_id: request.sourceProductId,
            decant_variant_id: assignment.variantId,
            bottle_kind:
              assignment.bottleKind === "new"
                ? "planned"
                : assignment.bottleKind,
            bottle_id:
              assignment.bottleKind === "new"
                ? newBottleIds.get(assignment.bottleId)!
                : assignment.bottleId,
            volume_ml: assignment.volumeMl,
          })
          allocationIds.push(allocation.id)
        }
        return allocationIds
      } catch (error) {
        if (allocationIds.length)
          await stock.deleteDecantAllocations(allocationIds)
        if (plannedIds.length)
          await stock.deleteDecantPlannedBottles(plannedIds)
        if (reservationIds.length) {
          await deleteReservationsWorkflow(container).run({
            input: { ids: reservationIds },
          })
        }
        throw error
      }
    },
  )
}

/** Release only units still awaiting preparation. A sealed bottle reservation
 * is released when no other order uses that planned bottle. */
export async function releaseDecantAllocations(
  container: MedusaContainer,
  allocationIds: string[],
) {
  if (!allocationIds.length) return
  const stock: DecantStockModuleService = container.resolve(DECANT_STOCK_MODULE)
  const allocations = await stock.listDecantAllocations({ id: allocationIds })
  const locking = container.resolve(Modules.LOCKING)
  const keys = [
    ...new Set(
      allocations.map((allocation) =>
        decantSourceLock(allocation.source_product_id),
      ),
    ),
  ].sort()
  if (!keys.length) return
  await locking.execute(
    keys,
    async () => {
      const current = await stock.listDecantAllocations({ id: allocationIds })
      // Already-released rows are included to repair cleanup after an older
      // partial run. Prepared vials never restore physically deducted stock.
      const releasable = current.filter(
        (allocation) => allocation.status !== "prepared",
      )
      const reserved = releasable.filter(
        (allocation) => allocation.status === "reserved",
      )
      const releasingIds = new Set(reserved.map((allocation) => allocation.id))
      const plannedIds = [
        ...new Set(
          releasable
            .filter((allocation) => allocation.bottle_kind === "planned")
            .map((allocation) => allocation.bottle_id),
        ),
      ]
      const plans = plannedIds.length
        ? await stock.listDecantPlannedBottles({
            id: plannedIds,
            status: "planned",
          })
        : []
      const unusedPlans: typeof plans = []
      for (const plan of plans) {
        const remaining = await stock.listDecantAllocations({
          bottle_kind: "planned",
          bottle_id: plan.id,
          status: "reserved",
        })
        if (remaining.every((allocation) => releasingIds.has(allocation.id))) {
          unusedPlans.push(plan)
        }
      }
      const inventory = container.resolve(Modules.INVENTORY)
      const reservationIds = unusedPlans.map((plan) => plan.reservation_id)
      const reservations = reservationIds.length
        ? await inventory.listReservationItems(
            { id: reservationIds },
            {
              select: ["id", "inventory_item_id"],
            },
          )
        : []
      const inventoryKeys = [
        ...new Set(
          reservations.map((reservation) => reservation.inventory_item_id),
        ),
      ].sort()
      const releaseUnderInventoryLocks = async () => {
        const activeReservations = reservationIds.length
          ? await inventory.listReservationItems(
              { id: reservationIds },
              {
                select: ["id", "inventory_item_id"],
              },
            )
          : []
        if (
          activeReservations.some(
            (reservation) =>
              !inventoryKeys.includes(reservation.inventory_item_id),
          )
        ) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            "Складовата резервация беше променена. Опитайте освобождаването отново.",
          )
        }
        // Only restore reservations deleted by this attempt, not rows another
        // operation had already removed while the inventory lock was queued.
        const activeReservationIds = activeReservations.map(
          (reservation) => reservation.id,
        )
        let reservationsDeleted = false
        let allocationsReleased = false
        try {
          if (activeReservationIds.length) {
            // Keep inventory locks through plan/allocation writes and rollback.
            // Releasing the inventory lock immediately after deletion would let
            // another checkout consume stock before compensation can restore it.
            await inventory.softDeleteReservationItems(activeReservationIds)
            reservationsDeleted = true
          }
          if (reserved.length) {
            await stock.updateDecantAllocations(
              reserved.map((allocation) => ({
                id: allocation.id,
                status: "released" as const,
              })),
            )
            allocationsReleased = true
          }
          if (unusedPlans.length) {
            await stock.updateDecantPlannedBottles(
              unusedPlans.map((plan) => ({
                id: plan.id,
                status: "released" as const,
              })),
            )
          }
        } catch (error) {
          const rollbackErrors: unknown[] = []
          if (reservationsDeleted) {
            try {
              await inventory.restoreReservationItems(activeReservationIds)
            } catch (rollbackError) {
              rollbackErrors.push(rollbackError)
            }
          }
          if (allocationsReleased) {
            try {
              await stock.updateDecantAllocations(
                reserved.map((allocation) => ({
                  id: allocation.id,
                  status: "reserved" as const,
                })),
              )
            } catch (rollbackError) {
              rollbackErrors.push(rollbackError)
            }
          }
          if (rollbackErrors.length) {
            throw new MedusaError(
              MedusaError.Types.UNEXPECTED_STATE,
              "Освобождаването не завърши и възстановяването е непълно. Нужна е ръчна проверка.",
            )
          }
          throw error
        }
      }
      if (inventoryKeys.length) {
        await locking.execute(inventoryKeys, releaseUnderInventoryLocks, {
          timeout: 30,
        })
      } else {
        await releaseUnderInventoryLocks()
      }
    },
    { timeout: 30 },
  )
}
