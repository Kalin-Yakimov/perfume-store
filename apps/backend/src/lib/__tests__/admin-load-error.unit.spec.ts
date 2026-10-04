import { isMissingAdminRecord } from "../../admin/lib/load-error"

it("only treats an actual HTTP 404 as a missing record", () => {
  expect(
    isMissingAdminRecord(
      Object.assign(new Error("not found"), { status: 404 }),
    ),
  ).toBe(true)
  for (const error of [
    null,
    undefined,
    new Error("network outage"),
    { status: 500 },
    { status: 401 },
    { status: "404" },
  ]) {
    expect(isMissingAdminRecord(error)).toBe(false)
  }
})
