import { isOrderCanceledForPreparation } from "../order-preparation"

describe("order preparation eligibility", () => {
  it("rejects canceled orders", () => {
    expect(isOrderCanceledForPreparation({ status: "canceled" })).toBe(true)
  })

  it("rejects orders with a cancellation timestamp", () => {
    expect(isOrderCanceledForPreparation({ status: "pending", canceled_at: new Date() })).toBe(true)
  })

  it("allows orders that have not been canceled", () => {
    expect(isOrderCanceledForPreparation({ status: "pending", canceled_at: null })).toBe(false)
  })
})
