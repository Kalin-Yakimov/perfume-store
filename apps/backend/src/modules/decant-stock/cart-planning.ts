import { packDecants } from "./packing"
import type {
  DecantBottleCapacity,
  SealedBottleSlot,
} from "./packing"
import type { PreviewCartItem } from "./cart-preview"
import type { SourceRequest, StockSnapshot } from "./stock"

/** Pure stock planner shared by storefront validation and unit tests. */
export function canPackCartDecants(
  items: PreviewCartItem[],
  requests: SourceRequest[],
  snapshots: Map<string, StockSnapshot>,
): boolean {
  for (const request of requests) {
    const snapshot = snapshots.get(request.sourceProductId)
    if (!snapshot) return false

    const slots = snapshot.sealedSlots.map((slot) => ({ ...slot }))
    let wholeBottles = items.reduce(
      (total, item) =>
        total +
        (item.variant_id === request.sourceVariantId
          ? Number(item.quantity || 0)
          : 0),
      0,
    )

    for (const slot of slots) {
      const taken = Math.min(wholeBottles, slot.availableUnits)
      slot.availableUnits -= taken
      wholeBottles -= taken
    }

    if (
      wholeBottles > 0 ||
      !packDecants(request.units, snapshot.bottles, slots, snapshot.usableMl)
    ) {
      return false
    }
  }

  return true
}

export function maxAdditionalDecantsForSnapshot({
  existingUnits,
  variantId,
  candidateVolumeMl,
  alreadyInCart,
  bottles,
  sealedSlots,
  usableMl,
}: {
  existingUnits: SourceRequest["units"]
  variantId: string
  candidateVolumeMl: number
  alreadyInCart: number
  bottles: DecantBottleCapacity[]
  sealedSlots: SealedBottleSlot[]
  usableMl: number
}): number {
  if (
    !Number.isFinite(candidateVolumeMl) ||
    candidateVolumeMl <= 0 ||
    !Number.isInteger(alreadyInCart) ||
    alreadyInCart < 0
  ) {
    return 0
  }

  const availableMl =
    bottles.reduce((sum, bottle) => sum + Math.max(0, bottle.freeMl), 0) +
    sealedSlots.reduce(
      (sum, slot) => sum + Math.max(0, slot.availableUnits) * usableMl,
      0,
    )
  let low = 0
  let high = Math.max(
    0,
    Math.min(
      500 - alreadyInCart,
      Math.floor(availableMl / candidateVolumeMl),
    ),
  )

  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    const units = [
      ...existingUnits,
      ...Array.from({ length: middle }, () => ({ variantId, volumeMl: candidateVolumeMl })),
    ]
    if (packDecants(units, bottles, sealedSlots, usableMl)) {
      low = middle
    } else {
      high = middle - 1
    }
  }

  return low
}
