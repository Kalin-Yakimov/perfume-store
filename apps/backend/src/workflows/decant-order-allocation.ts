type DecantAllocationForPreparation = {
  id: string
  bottle_id: string
  bottle_kind: string
  volume_ml: number
}

export type BottlePreparationGroup = {
  bottle_id: string
  volume_ml: number
  allocation_ids: string[]
}

const roundMl = (value: number) => Math.round(value * 100) / 100

/** Sum vial volumes by their resolved physical bottle for order preparation. */
export function groupDecantAllocationsByBottle(
  allocations: DecantAllocationForPreparation[],
): BottlePreparationGroup[] | null {
  const groups = new Map<string, BottlePreparationGroup>()

  for (const allocation of allocations) {
    if (!Number.isFinite(allocation.volume_ml) || allocation.volume_ml <= 0) {
      return null
    }
    const key = `${allocation.bottle_kind}:${allocation.bottle_id}`
    const group = groups.get(key) || {
      bottle_id: allocation.bottle_id,
      volume_ml: 0,
      allocation_ids: [],
    }
    group.volume_ml = roundMl(group.volume_ml + allocation.volume_ml)
    group.allocation_ids.push(allocation.id)
    groups.set(key, group)
  }

  return [...groups.values()]
}
