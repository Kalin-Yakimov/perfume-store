import { parsePage } from "../parse-page"

it.each([undefined, "", "0", "-1", "2.5", "NaN", "100002", "9007199254740993"])(
  "normalizes an invalid page %s",
  (value) => {
    expect(parsePage(value)).toBe(1)
  },
)
it.each(["1", "2", "100001"])(
  "preserves a bounded integer page %s",
  (value) => {
    expect(parsePage(value)).toBe(Number(value))
  },
)
