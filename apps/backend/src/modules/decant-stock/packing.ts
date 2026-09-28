export type DecantUnit = {
  variantId: string
  volumeMl: number
}

export type DecantBottleCapacity = {
  id: string
  kind: "open" | "planned"
  freeMl: number
}

export type SealedBottleSlot = {
  inventoryItemId: string
  locationId: string
  availableUnits: number
}

export type DecantAssignment = DecantUnit & {
  bottleId: string
  bottleKind: "open" | "planned" | "new"
}

export type NewBottle = {
  id: string
  inventoryItemId: string
  locationId: string
}

export type DecantPlan = {
  assignments: DecantAssignment[]
  newBottles: NewBottle[]
}

/** Each vial must fit inside one bottle. The 5 ml technical reserve is
 * excluded from newBottleUsableMl before this function is called. */
export function packDecants(
  units: DecantUnit[],
  bottles: DecantBottleCapacity[],
  sealedSlots: SealedBottleSlot[],
  newBottleUsableMl: number
): DecantPlan | null {
  if (!Number.isFinite(newBottleUsableMl) || newBottleUsableMl <= 0) {
    return null
  }

  const capacities: (Omit<DecantBottleCapacity, "kind"> & {
    kind: "open" | "planned" | "new"
  })[] = bottles.map((bottle) => ({
    ...bottle,
    freeMl: Math.max(0, bottle.freeMl),
  }))
  const slots = sealedSlots.map((slot) => ({ ...slot }))
  const assignments: DecantAssignment[] = []
  const newBottles: NewBottle[] = []

  // Larger vials first avoids consuming the only 10 ml space with a 5 ml vial.
  const sortedUnits = [...units].sort((a, b) => b.volumeMl - a.volumeMl)
  for (const unit of sortedUnits) {
    if (!Number.isFinite(unit.volumeMl) || unit.volumeMl <= 0) return null

    const fitting = capacities
      .filter((bottle) => bottle.freeMl >= unit.volumeMl)
      .sort((a, b) => {
        const aRank = a.kind === "open" ? 0 : a.kind === "planned" ? 1 : 2
        const bRank = b.kind === "open" ? 0 : b.kind === "planned" ? 1 : 2
        return aRank - bRank || a.freeMl - b.freeMl
      })[0]

    if (fitting) {
      fitting.freeMl -= unit.volumeMl
      assignments.push({
        ...unit,
        bottleId: fitting.id,
        bottleKind: fitting.kind,
      })
      continue
    }

    if (unit.volumeMl > newBottleUsableMl) return null
    const slot = slots.find((candidate) => candidate.availableUnits > 0)
    if (!slot) return null
    slot.availableUnits -= 1
    const id = `new-${newBottles.length}`
    newBottles.push({
      id,
      inventoryItemId: slot.inventoryItemId,
      locationId: slot.locationId,
    })
    capacities.push({
      id,
      kind: "new",
      freeMl: newBottleUsableMl - unit.volumeMl,
    })
    assignments.push({ ...unit, bottleId: id, bottleKind: "new" })
  }

  return { assignments, newBottles }
}
