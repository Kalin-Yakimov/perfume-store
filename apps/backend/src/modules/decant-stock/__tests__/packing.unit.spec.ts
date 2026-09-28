import { packDecants } from "../packing"

describe("decant packing", () => {
  const tenMl = (count: number) =>
    Array.from({ length: count }, () => ({ variantId: "decant-10", volumeMl: 10 }))

  it("uses two 100 ml bottles for eleven 10 ml vials with a 5 ml reserve per bottle", () => {
    const plan = packDecants(
      tenMl(11),
      [],
      [{ inventoryItemId: "whole-100", locationId: "main", availableUnits: 10 }],
      95
    )

    expect(plan?.newBottles).toHaveLength(2)
    expect(plan?.assignments.filter((item) => item.bottleId === "new-0")).toHaveLength(9)
    expect(plan?.assignments.filter((item) => item.bottleId === "new-1")).toHaveLength(2)
  })

  it("never combines leftovers from separate bottles into one vial", () => {
    const plan = packDecants(
      tenMl(1),
      [
        { id: "first", kind: "open", freeMl: 5 },
        { id: "second", kind: "open", freeMl: 5 },
      ],
      [],
      95
    )
    expect(plan).toBeNull()
  })

  it("uses already opened stock before reserving a sealed bottle", () => {
    const plan = packDecants(
      [...tenMl(1), { variantId: "decant-5", volumeMl: 5 }],
      [{ id: "opened", kind: "open", freeMl: 15 }],
      [{ inventoryItemId: "whole-100", locationId: "main", availableUnits: 1 }],
      95
    )
    expect(plan?.newBottles).toHaveLength(0)
    expect(plan?.assignments.every((item) => item.bottleId === "opened")).toBe(true)
  })
})
