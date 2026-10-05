import "server-only"

import { listLocales } from "@lib/data/locales"
import { getLocale } from "@lib/data/locale-actions"
import SideMenu from "../side-menu"

export default async function MobileMenu() {
  const [locales, currentLocale] = await Promise.all([
    listLocales(),
    getLocale(),
  ])

  return <SideMenu locales={locales} currentLocale={currentLocale} />
}
