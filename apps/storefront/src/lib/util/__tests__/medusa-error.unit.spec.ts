import { FetchError } from "@medusajs/js-sdk"
import medusaError, { getMedusaErrorStatus } from "../medusa-error"

describe("Medusa SDK errors", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}))
  afterEach(() => jest.restoreAllMocks())

  it("reads a real SDK conflict and legacy error status", () => {
    expect(
      getMedusaErrorStatus(new FetchError("Няма наличност", "Conflict", 409)),
    ).toBe(409)
    expect(getMedusaErrorStatus({ response: { status: 409 } })).toBe(409)
    expect(getMedusaErrorStatus(null)).toBeUndefined()
    expect(getMedusaErrorStatus({ status: "409" })).toBeUndefined()
  })

  it("preserves safe validation messages without logging them", () => {
    expect(() =>
      medusaError(
        new FetchError("Няма\nдостатъчна наличност", "Conflict", 409),
      ),
    ).toThrow("Няма достатъчна наличност")
    expect(console.error).toHaveBeenCalledWith(
      "Medusa request failed with status",
      409,
    )
    expect(() =>
      medusaError({
        response: { status: 400, data: { message: "x".repeat(400) } },
      }),
    ).toThrow("x".repeat(300))
  })

  it("does not reveal upstream server or network details", () => {
    for (const error of [
      new FetchError("secret@example.test token=secret", "Server error", 500),
      new Error("secret"),
    ]) {
      expect(() => medusaError(error)).toThrow(
        "Заявката не можа да бъде изпълнена. Опитайте отново.",
      )
    }
    expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toContain(
      "secret",
    )
  })
})
