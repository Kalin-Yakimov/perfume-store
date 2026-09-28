import {
  canPackCartDecants,
  maxAdditionalDecantsForSnapshot,
} from "../cart-planning"
import type { SourceRequest, StockSnapshot } from "../stock"

const request = (units: number, size = 10): SourceRequest => ({
  sourceProductId: "perfume-1",
  sourceVariantId: "whole-100",
  sourceVolumeMl: 100,
  units: Array.from({ length: units }, () => ({
    variantId: `decant-${size}`,
    volumeMl: size,
  })),
})

const snapshot = (
  bottles: StockSnapshot["bottles"],
  sealedUnits: number,
): StockSnapshot => ({
  bottles,
  sealedSlots: [
    { inventoryItemId: "whole-item", locationId: "main", availableUnits: sealedUnits },
  ],
  usableMl: 95,
})

describe("decant cart availability planning", () => {
  it("allows a request that fits in already-open stock", () => {
    expect(
      canPackCartDecants(
        [],
        [request(2)],
        new Map([["perfume-1", snapshot([{ id: "open-1", kind: "open", freeMl: 20 }], 0)]]),
      ),
    ).toBe(true)
  })

  it("requires a second sealed bottle when eleven 10 ml vials exceed one bottle", () => {
    expect(
      canPackCartDecants(
        [],
        [request(11)],
        new Map([["perfume-1", snapshot([], 2)]]),
      ),
    ).toBe(true)

    expect(
      canPackCartDecants(
        [],
        [request(11)],
        new Map([["perfume-1", snapshot([], 1)]]),
      ),
    ).toBe(false)
  })

  it("counts whole bottles in the same cart against decant source stock", () => {
    expect(
      canPackCartDecants(
        [{ variant_id: "whole-100", quantity: 1 }],
        [request(10)],
        new Map([["perfume-1", snapshot([], 1)]]),
      ),
    ).toBe(false)
  })

  it("limits added vials by per-bottle capacity, not just total millilitres", () => {
    expect(
      maxAdditionalDecantsForSnapshot({
        existingUnits: [],
        variantId: "decant-10",
        candidateVolumeMl: 10,
        alreadyInCart: 0,
        bottles: [{ id: "open-1", kind: "open", freeMl: 5 }],
        sealedSlots: [
          { inventoryItemId: "whole-item", locationId: "main", availableUnits: 1 },
        ],
        usableMl: 95,
      }),
    ).toBe(9)
  })

  it("subtracts the existing quantity and keeps the platform safety cap", () => {
    expect(
      maxAdditionalDecantsForSnapshot({
        existingUnits: [],
        variantId: "decant-5",
        candidateVolumeMl: 5,
        alreadyInCart: 498,
        bottles: [{ id: "open-1", kind: "open", freeMl: 1000 }],
        sealedSlots: [],
        usableMl: 95,
      }),
    ).toBe(2)
  })
})
