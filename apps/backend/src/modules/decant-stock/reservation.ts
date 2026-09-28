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
    "Няма достатъчно налични парфюми за избраните отливки. Намалете количеството или опитайте по-късно."
  )

export async function reserveDecantSource(
  container: MedusaContainer,
  cartId: string,
  request: SourceRequest,
  salesChannelId?: string | null
): Promise<string[]> {
  const locking = container.resolve(Modules.LOCKING)
  return locking.execute(decantSourceLock(request.sourceProductId), async () => {
    const stock: DecantStockModuleService = container.resolve(DECANT_STOCK_MODULE)
    const snapshot = await readStockSnapshot(container, request, salesChannelId)
    const plan = packDecants(
      request.units,
      snapshot.bottles,
      snapshot.sealedSlots,
      snapshot.usableMl
    )
    if (!plan) throw notEnoughStock()

    let reservationIds: string[] = []
    let plannedIds: string[] = []
    let allocationIds: string[] = []
    try {
      const reservations = plan.newBottles.length
        ? (await createReservationsWorkflow(container).run({
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
          })).result
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
          bottle_kind: assignment.bottleKind === "new" ? "planned" : assignment.bottleKind,
          bottle_id: assignment.bottleKind === "new"
            ? newBottleIds.get(assignment.bottleId)!
            : assignment.bottleId,
          volume_ml: assignment.volumeMl,
        })
        allocationIds.push(allocation.id)
      }
      return allocationIds
    } catch (error) {
      if (allocationIds.length) await stock.deleteDecantAllocations(allocationIds)
      if (plannedIds.length) await stock.deleteDecantPlannedBottles(plannedIds)
      if (reservationIds.length) {
        await deleteReservationsWorkflow(container).run({
          input: { ids: reservationIds },
        })
      }
      throw error
    }
  })
}

/** Release only units still awaiting preparation. A sealed bottle reservation
 * is released when no other order uses that planned bottle. */
export async function releaseDecantAllocations(
  container: MedusaContainer,
  allocationIds: string[]
) {
  if (!allocationIds.length) return
  const stock: DecantStockModuleService = container.resolve(DECANT_STOCK_MODULE)
  const allocations = await stock.listDecantAllocations({ id: allocationIds })
  const bySource = new Map<string, typeof allocations>()
  for (const allocation of allocations) {
    const group = bySource.get(allocation.source_product_id) || []
    group.push(allocation)
    bySource.set(allocation.source_product_id, group)
  }

  const locking = container.resolve(Modules.LOCKING)
  for (const [sourceProductId, group] of bySource) {
    await locking.execute(decantSourceLock(sourceProductId), async () => {
      const plannedIds = new Set<string>()
      const current = await stock.listDecantAllocations({
        id: group.map((item) => item.id),
      })
      for (const allocation of current) {
        if (allocation.status !== "reserved") continue
        await stock.updateDecantAllocations({
          id: allocation.id,
          status: "released",
        })
        if (allocation.bottle_kind === "planned") plannedIds.add(allocation.bottle_id)
      }

      for (const plannedId of plannedIds) {
        const remaining = await stock.listDecantAllocations({
          bottle_kind: "planned",
          bottle_id: plannedId,
          status: "reserved",
        })
        if (remaining.length) continue
        const planned = await stock.retrieveDecantPlannedBottle(plannedId)
        if (planned.status !== "planned") continue
        await deleteReservationsWorkflow(container).run({
          input: { ids: [planned.reservation_id] },
        })
        await stock.updateDecantPlannedBottles({
          id: plannedId,
          status: "released",
        })
      }
    })
  }
}
