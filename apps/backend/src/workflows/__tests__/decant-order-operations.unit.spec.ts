import type { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { DECANT_STOCK_MODULE } from "../../modules/decant-stock"
import { releaseDecantAllocations } from "../../modules/decant-stock/reservation"
import {
  linkDecantAllocationsForOrder,
  readDecantAllocationsForOrder,
  releaseDecantAllocationsForOrder,
} from "../decant-order-operations"

jest.mock("../../modules/decant-stock/reservation", () => ({
  decantSourceLock: (id: string) => `decant-stock:${id}`,
  releaseDecantAllocations: jest.fn(),
}))

type Allocation = {
  id: string
  order_id: string | null
  cart_id: string
  source_product_id: string
  status: "reserved" | "released" | "prepared"
}

const allocation = (
  id: string,
  overrides: Partial<Allocation> = {},
): Allocation => ({
  id,
  order_id: null,
  cart_id: "cart-1",
  source_product_id: "source-1",
  status: "reserved",
  ...overrides,
})

function fixture(allocations: Allocation[] = [allocation("a")]) {
  const state = { status: "pending", canceled_at: null as Date | null }
  const query = {
    graph: jest.fn(async ({ entity }: { entity: string }) => ({
      data:
        entity === "order"
          ? [{ id: "order-1", ...state }]
          : [{ cart_id: "cart-1" }],
    })),
  }
  const stock = {
    listDecantAllocations: jest.fn(async (filters: Record<string, unknown>) =>
      allocations.filter((item) =>
        Object.entries(filters).every(
          ([key, value]) => item[key as keyof Allocation] === value,
        ),
      ),
    ),
    updateDecantAllocations: jest.fn(async (updates: Partial<Allocation>[]) => {
      for (const update of updates)
        Object.assign(
          allocations.find((item) => item.id === update.id)!,
          update,
        )
      return allocations
    }),
  }
  const locking = {
    execute: jest.fn(
      async (_keys: string | string[], operation: () => Promise<unknown>) =>
        operation(),
    ),
  }
  const container = {
    resolve(key: string) {
      if (key === ContainerRegistrationKeys.QUERY) return query
      if (key === DECANT_STOCK_MODULE) return stock
      if (key === Modules.LOCKING) return locking
      throw new Error(`Unexpected service ${key}`)
    },
  } as unknown as MedusaContainer
  return { container, query, stock, locking, state, allocations }
}

describe("decant order reconciliation", () => {
  beforeEach(() => jest.clearAllMocks())

  it("links all unassigned vials in one atomic module call and is idempotent", async () => {
    const f = fixture([
      allocation("a", { source_product_id: "source-2" }),
      allocation("b"),
      allocation("c", { order_id: "order-1" }),
    ])
    await linkDecantAllocationsForOrder(f.container, "order-1")
    await linkDecantAllocationsForOrder(f.container, "order-1")
    expect(f.stock.updateDecantAllocations).toHaveBeenCalledTimes(1)
    expect(f.stock.updateDecantAllocations).toHaveBeenCalledWith([
      { id: "a", order_id: "order-1" },
      { id: "b", order_id: "order-1" },
    ])
    expect(f.locking.execute.mock.calls[0][0]).toEqual([
      "decant-order:order-1",
      "decant-stock:source-1",
      "decant-stock:source-2",
    ])
  })

  it("does not link a canceled order after a delayed order.placed event", async () => {
    const f = fixture()
    f.state.status = "canceled"
    await linkDecantAllocationsForOrder(f.container, "order-1")
    expect(f.stock.updateDecantAllocations).not.toHaveBeenCalled()
    expect(f.locking.execute).not.toHaveBeenCalled()
  })

  it("rechecks cancellation after waiting for the source lock", async () => {
    const f = fixture()
    f.locking.execute.mockImplementationOnce(async (_keys, operation) => {
      f.state.canceled_at = new Date()
      return operation()
    })
    await linkDecantAllocationsForOrder(f.container, "order-1")
    expect(f.stock.updateDecantAllocations).not.toHaveBeenCalled()
    expect(f.allocations[0].order_id).toBeNull()
  })

  it("validates every conflicting owner before writing any allocation", async () => {
    const f = fixture([
      allocation("a"),
      allocation("b", { order_id: "other-order" }),
    ])
    await expect(
      linkDecantAllocationsForOrder(f.container, "order-1"),
    ).rejects.toThrow("друга поръчка")
    expect(f.stock.updateDecantAllocations).not.toHaveBeenCalled()
    expect(f.allocations[0].order_id).toBeNull()
  })

  it("does not link rows released or prepared while it waited", async () => {
    const f = fixture([allocation("a"), allocation("b")])
    f.locking.execute.mockImplementationOnce(async (_keys, operation) => {
      f.allocations[0].status = "released"
      f.allocations[1].status = "prepared"
      return operation()
    })
    await linkDecantAllocationsForOrder(f.container, "order-1")
    expect(f.stock.updateDecantAllocations).not.toHaveBeenCalled()
  })

  it("leaves allocations untouched when the order/cart link is not yet available", async () => {
    const f = fixture()
    f.query.graph.mockImplementation(async ({ entity }) => ({
      data: entity === "order" ? [{ id: "order-1", ...f.state }] : [],
    }))
    await linkDecantAllocationsForOrder(f.container, "order-1")
    expect(f.stock.updateDecantAllocations).not.toHaveBeenCalled()
  })

  it("reads linked plus unlinked cart allocations without changing their owners", async () => {
    const f = fixture([
      allocation("linked", { order_id: "order-1" }),
      allocation("pending"),
      allocation("other", { order_id: "other-order" }),
      allocation("prepared", { order_id: "order-1", status: "prepared" }),
    ])
    const result = await readDecantAllocationsForOrder(f.container, "order-1")
    expect(result.map((item) => item.id).sort()).toEqual([
      "linked",
      "pending",
      "prepared",
    ])
    expect(f.stock.updateDecantAllocations).not.toHaveBeenCalled()
    expect(f.locking.execute).not.toHaveBeenCalled()
  })

  it("cancellation releases partially linked orders and retries old released rows, but never prepared vials", async () => {
    const f = fixture([
      allocation("linked", { order_id: "order-1" }),
      allocation("pending"),
      allocation("old-partial", { order_id: "order-1", status: "released" }),
      allocation("prepared", { order_id: "order-1", status: "prepared" }),
      allocation("other", { order_id: "other-order" }),
    ])
    f.state.status = "canceled"
    await releaseDecantAllocationsForOrder(f.container, "order-1")
    expect(releaseDecantAllocations).toHaveBeenCalledWith(f.container, [
      "linked",
      "old-partial",
      "pending",
    ])
    expect(f.locking.execute.mock.calls[0][0]).toBe("decant-order:order-1")
  })

  it("does not release a still-active order even if a stale cancellation event arrives", async () => {
    const f = fixture()
    await releaseDecantAllocationsForOrder(f.container, "order-1")
    expect(releaseDecantAllocations).not.toHaveBeenCalled()
  })
})
