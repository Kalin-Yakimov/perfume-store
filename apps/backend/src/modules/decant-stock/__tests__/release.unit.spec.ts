import type { MedusaContainer } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

import { DECANT_STOCK_MODULE } from ".."
import { releaseDecantAllocations } from "../reservation"

jest.mock("@medusajs/medusa/core-flows", () => ({
  createReservationsWorkflow: jest.fn(),
  deleteReservationsWorkflow: jest.fn(),
}))

type Allocation = {
  id: string
  source_product_id: string
  bottle_kind: "open" | "planned"
  bottle_id: string
  status: "reserved" | "prepared" | "released"
}
type Plan = {
  id: string
  reservation_id: string
  status: "planned" | "opened" | "released"
}

function fixture(
  allocations: Allocation[] = [
    {
      id: "a",
      source_product_id: "source-1",
      bottle_kind: "planned",
      bottle_id: "plan-1",
      status: "reserved",
    },
  ],
  plans: Plan[] = [
    { id: "plan-1", reservation_id: "reservation-1", status: "planned" },
  ],
) {
  const reservations = plans.map((plan) => ({
    id: plan.reservation_id,
    inventory_item_id: `inventory-${plan.id}`,
    deleted: false,
  }))
  const matches = (item: object, filters: Record<string, unknown>) =>
    Object.entries(filters).every(([key, value]) =>
      Array.isArray(value) ? value.includes(item[key]) : item[key] === value,
    )
  const stock = {
    listDecantAllocations: jest.fn(async (filters: Record<string, unknown>) =>
      allocations
        .filter((item) => matches(item, filters))
        .map((item) => ({ ...item })),
    ),
    listDecantPlannedBottles: jest.fn(
      async (filters: Record<string, unknown>) =>
        plans
          .filter((item) => matches(item, filters))
          .map((item) => ({ ...item })),
    ),
    updateDecantAllocations: jest.fn(async (updates: Partial<Allocation>[]) => {
      for (const update of updates)
        Object.assign(
          allocations.find((item) => item.id === update.id)!,
          update,
        )
      return allocations
    }),
    updateDecantPlannedBottles: jest.fn(async (updates: Partial<Plan>[]) => {
      for (const update of updates)
        Object.assign(
          plans.find((item) => item.id === update.id)!,
          update,
        )
      return plans
    }),
  }
  const inventory = {
    listReservationItems: jest.fn(async ({ id }: { id: string[] }) =>
      reservations.filter((item) => id.includes(item.id) && !item.deleted),
    ),
    restoreReservationItems: jest.fn(async (ids: string[]) => {
      for (const item of reservations)
        if (ids.includes(item.id)) item.deleted = false
    }),
    softDeleteReservationItems: jest.fn(async (ids: string[]) => {
      for (const item of reservations)
        if (ids.includes(item.id)) item.deleted = true
    }),
  }
  const deletion = inventory.softDeleteReservationItems
  const locking = {
    execute: jest.fn(
      async (_keys: string[], operation: () => Promise<unknown>) => operation(),
    ),
  }
  const container = {
    resolve(key: string) {
      if (key === DECANT_STOCK_MODULE) return stock
      if (key === Modules.INVENTORY) return inventory
      if (key === Modules.LOCKING) return locking
      throw new Error(`Unexpected service ${key}`)
    },
  } as unknown as MedusaContainer
  return {
    container,
    stock,
    inventory,
    locking,
    deletion,
    allocations,
    plans,
    reservations,
  }
}

describe("consistent decant reservation release", () => {
  beforeEach(() => jest.clearAllMocks())

  it("releases once and repeated cleanup does not delete reservations twice", async () => {
    const f = fixture()
    await releaseDecantAllocations(f.container, ["a"])
    await releaseDecantAllocations(f.container, ["a"])
    expect(f.allocations[0].status).toBe("released")
    expect(f.plans[0].status).toBe("released")
    expect(f.deletion).toHaveBeenCalledTimes(1)
    expect(f.locking.execute.mock.calls[1][0]).toEqual(["inventory-plan-1"])
  })

  it("does not release a shared planned bottle while another order needs it", async () => {
    const f = fixture([
      {
        id: "a",
        source_product_id: "source-1",
        bottle_kind: "planned",
        bottle_id: "plan-1",
        status: "reserved",
      },
      {
        id: "other",
        source_product_id: "source-1",
        bottle_kind: "planned",
        bottle_id: "plan-1",
        status: "reserved",
      },
    ])
    await releaseDecantAllocations(f.container, ["a"])
    expect(f.allocations[0].status).toBe("released")
    expect(f.allocations[1].status).toBe("reserved")
    expect(f.plans[0].status).toBe("planned")
    expect(f.deletion).not.toHaveBeenCalled()
  })

  it("never restores physical stock for a prepared vial", async () => {
    const f = fixture([
      {
        id: "a",
        source_product_id: "source-1",
        bottle_kind: "open",
        bottle_id: "open-1",
        status: "prepared",
      },
    ])
    await releaseDecantAllocations(f.container, ["a"])
    expect(f.stock.updateDecantAllocations).not.toHaveBeenCalled()
    expect(f.deletion).not.toHaveBeenCalled()
    expect(f.allocations[0].status).toBe("prepared")
  })

  it("cleans up a previously released allocation whose sealed reservation remained", async () => {
    const f = fixture()
    f.allocations[0].status = "released"
    await releaseDecantAllocations(f.container, ["a"])
    expect(f.stock.updateDecantAllocations).not.toHaveBeenCalled()
    expect(f.deletion).toHaveBeenCalledTimes(1)
    expect(f.plans[0].status).toBe("released")
  })

  it("repairs old missing-reservation cleanup without recreating stock", async () => {
    const f = fixture()
    f.allocations[0].status = "released"
    f.reservations[0].deleted = true
    await releaseDecantAllocations(f.container, ["a"])
    expect(f.deletion).not.toHaveBeenCalled()
    expect(f.inventory.restoreReservationItems).not.toHaveBeenCalled()
    expect(f.plans[0].status).toBe("released")
  })

  it("leaves all allocation statuses unchanged if reservation deletion fails", async () => {
    const f = fixture()
    f.deletion.mockRejectedValueOnce(new Error("Test deletion failure"))
    await expect(releaseDecantAllocations(f.container, ["a"])).rejects.toThrow(
      "Test deletion failure",
    )
    expect(f.allocations[0].status).toBe("reserved")
    expect(f.plans[0].status).toBe("planned")
    expect(f.stock.updateDecantAllocations).not.toHaveBeenCalled()
  })

  it("restores the reservation if the allocation transaction fails", async () => {
    const f = fixture()
    f.stock.updateDecantAllocations.mockRejectedValueOnce(
      new Error("Test allocation failure"),
    )
    await expect(releaseDecantAllocations(f.container, ["a"])).rejects.toThrow(
      "Test allocation failure",
    )
    expect(f.reservations[0].deleted).toBe(false)
    expect(f.allocations[0].status).toBe("reserved")
    expect(f.inventory.restoreReservationItems).toHaveBeenCalledWith([
      "reservation-1",
    ])
  })

  it("does not restore a reservation deleted externally while its inventory lock was queued", async () => {
    const f = fixture()
    f.locking.execute.mockImplementation(async (keys, operation) => {
      if (keys.includes("inventory-plan-1")) f.reservations[0].deleted = true
      return operation()
    })
    f.stock.updateDecantPlannedBottles.mockRejectedValueOnce(
      new Error("Test plan failure"),
    )
    await expect(releaseDecantAllocations(f.container, ["a"])).rejects.toThrow(
      "Test plan failure",
    )
    expect(f.inventory.restoreReservationItems).not.toHaveBeenCalled()
    expect(f.deletion).not.toHaveBeenCalled()
    expect(f.reservations[0].deleted).toBe(true)
    expect(f.allocations[0].status).toBe("reserved")
  })

  it("rolls back every source when a later plan transaction fails and can retry", async () => {
    const f = fixture(
      [
        {
          id: "a",
          source_product_id: "source-2",
          bottle_kind: "planned",
          bottle_id: "plan-1",
          status: "reserved",
        },
        {
          id: "b",
          source_product_id: "source-1",
          bottle_kind: "planned",
          bottle_id: "plan-2",
          status: "reserved",
        },
      ],
      [
        { id: "plan-1", reservation_id: "reservation-1", status: "planned" },
        { id: "plan-2", reservation_id: "reservation-2", status: "planned" },
      ],
    )
    f.stock.updateDecantPlannedBottles.mockRejectedValueOnce(
      new Error("Test plan failure"),
    )
    await expect(
      releaseDecantAllocations(f.container, ["a", "b"]),
    ).rejects.toThrow("Test plan failure")
    expect(f.allocations.every((item) => item.status === "reserved")).toBe(true)
    expect(f.reservations.every((item) => !item.deleted)).toBe(true)
    expect(f.locking.execute.mock.calls[0][0]).toEqual([
      "decant-stock:source-1",
      "decant-stock:source-2",
    ])
    await releaseDecantAllocations(f.container, ["a", "b"])
    expect(f.allocations.every((item) => item.status === "released")).toBe(true)
    expect(f.plans.every((item) => item.status === "released")).toBe(true)
  })

  it("reports incomplete compensation without exposing the original exception", async () => {
    const f = fixture()
    f.stock.updateDecantPlannedBottles.mockRejectedValueOnce(
      new Error("Sensitive original failure"),
    )
    f.inventory.restoreReservationItems.mockRejectedValueOnce(
      new Error("Sensitive restore failure"),
    )
    await expect(releaseDecantAllocations(f.container, ["a"])).rejects.toThrow(
      "Нужна е ръчна проверка",
    )
    expect(f.allocations[0].status).toBe("reserved")
  })
})
