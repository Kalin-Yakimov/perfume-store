export type DeliveryCarrier = "econt" | "speedy" | "boxnow"

export type DeliveryPoint = {
  shippingOptionId: string
  carrier: DeliveryCarrier
  id: string
  name: string
  address: string
  city: string
  postalCode?: string
}

export function getDeliveryCarrier(name: string): DeliveryCarrier | null {
  const normalized = name.toLocaleLowerCase("bg-BG")
  if (normalized.includes("box now") || normalized.includes("boxnow")) {
    return "boxnow"
  }
  if (normalized.includes("еконт") || normalized.includes("econt")) {
    return "econt"
  }
  if (normalized.includes("спиди") || normalized.includes("speedy")) {
    return "speedy"
  }
  return null
}

export function needsDeliveryPoint(name: string): boolean {
  const normalized = name.toLocaleLowerCase("bg-BG")
  return (
    Boolean(getDeliveryCarrier(name)) &&
    !normalized.includes("адрес") &&
    !normalized.includes("address")
  )
}

export function readDeliveryPoint(value: unknown): DeliveryPoint | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const point = value as Record<string, unknown>
  if (
    typeof point.shippingOptionId !== "string" ||
    typeof point.carrier !== "string" ||
    !["econt", "speedy", "boxnow"].includes(point.carrier) ||
    typeof point.id !== "string" ||
    typeof point.name !== "string" ||
    typeof point.address !== "string" ||
    typeof point.city !== "string"
  )
    return null

  return point as DeliveryPoint
}
