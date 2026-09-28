import { groupDecantAllocationsByBottle } from "../decant-order-allocation"

describe("decant order bottle allocation", () => {
  it("groups ordered vials by physical bottle and sums millilitres", () => {
    expect(
      groupDecantAllocationsByBottle([
        { id: "a", bottle_id: "open-1", bottle_kind: "open", volume_ml: 10 },
        { id: "b", bottle_id: "open-1", bottle_kind: "open", volume_ml: 5 },
        { id: "c", bottle_id: "open-2", bottle_kind: "open", volume_ml: 10 },
      ]),
    ).toEqual([
      { bottle_id: "open-1", volume_ml: 15, allocation_ids: ["a", "b"] },
      { bottle_id: "open-2", volume_ml: 10, allocation_ids: ["c"] },
    ])
  })

  it("rounds accumulated millilitres consistently", () => {
    expect(
      groupDecantAllocationsByBottle([
        { id: "a", bottle_id: "open-1", bottle_kind: "open", volume_ml: 0.1 },
        { id: "b", bottle_id: "open-1", bottle_kind: "open", volume_ml: 0.2 },
      ])?.[0].volume_ml,
    ).toBe(0.3)
  })

  it("rejects zero, negative, and non-finite vial volumes", () => {
    for (const volume of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        groupDecantAllocationsByBottle([
          {
            id: "bad",
            bottle_id: "open-1",
            bottle_kind: "open",
            volume_ml: volume,
          },
        ]),
      ).toBeNull()
    }
  })
})
