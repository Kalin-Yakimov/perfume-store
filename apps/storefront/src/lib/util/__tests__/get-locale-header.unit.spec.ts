import { getLocale } from "@lib/data/locale-actions"
import { getLocaleHeader } from "../get-locale-header"

jest.mock("@lib/data/locale-actions", () => ({ getLocale: jest.fn() }))

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document")

afterEach(() => {
  if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument)
  else Reflect.deleteProperty(globalThis, "document")
  jest.resetAllMocks()
})

it("uses the server cookie reader during a server render", async () => {
  jest.mocked(getLocale).mockResolvedValue("bg")
  expect(await getLocaleHeader()).toEqual({ "x-medusa-locale": "bg" })
  expect(getLocale).toHaveBeenCalledTimes(1)
})

it.each([
  ["other=value; _medusa_locale=bg; trailing=value", "bg"],
  ["_medusa_locale=bg%2DBG", "bg-BG"],
  ["other=value", null],
  ["_medusa_locale=", null],
  ["_medusa_locale=%invalid", null],
])("reads the browser locale without invoking a server action: %s", async (cookie, locale) => {
  Object.defineProperty(globalThis, "document", { configurable: true, value: { cookie } })
  expect(await getLocaleHeader()).toEqual({ "x-medusa-locale": locale })
  expect(getLocale).not.toHaveBeenCalled()
})
