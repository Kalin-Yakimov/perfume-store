import { getLocale } from "@lib/data/locale-actions"

export async function getLocaleHeader() {
  // The locale cookie is intentionally readable by the browser. Calling a
  // server action here would add a storefront round trip to every SDK request.
  const locale = typeof document === "undefined"
    ? await getLocale()
    : readBrowserLocale(document.cookie)
  return {
    "x-medusa-locale": locale,
  } as const
}

function readBrowserLocale(cookieString: string): string | null {
  const value = cookieString.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith("_medusa_locale="))
    ?.slice("_medusa_locale=".length)
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}
