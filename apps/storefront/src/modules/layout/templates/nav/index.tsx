import { Suspense } from "react"

import { listLocales } from "@lib/data/locales"
import { getLocale } from "@lib/data/locale-actions"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import AccountMenu from "@modules/layout/components/account-menu"
import CartButton from "@modules/layout/components/cart-button"
import NavSearch from "@modules/layout/components/nav-search"
import SideMenu from "@modules/layout/components/side-menu"
import WishlistLink from "@modules/layout/components/wishlist-link"

const navigationItems = [
  ["Парфюми", "/parfyumi"],
  ["Отливки", "/otlivki"],
  ["Дизайнерски къщи", "/dizaynerski-kashti"],
  ["Парфюмни нотки", "/parfyumni-notki"],
]

export default async function Nav({
  customer,
}: {
  customer: HttpTypes.StoreCustomer | null
}) {
  const [locales, currentLocale] = await Promise.all([
    listLocales(),
    getLocale(),
  ])

  return (
    <div className="sticky inset-x-0 top-0 z-50">
      <div className="bg-[#28231f] px-4 py-2 text-center text-[9px] font-semibold uppercase tracking-[0.22em] text-[#eee5dc]">
        Безплатна доставка за поръчки над 150 €
      </div>

      <header className="border-b border-[#ded7cf]">
        <div className="bg-[#e5d8cc]">
          <div className="content-container">
            <div className="flex min-h-[72px] items-center gap-2 small:gap-4 small:grid small:grid-cols-[190px_minmax(300px,560px)_300px] small:justify-between">
              <div className="flex min-w-0 items-center gap-2 small:gap-4">
                <div className="h-[72px] small:hidden">
                  <SideMenu
                    locales={locales}
                    currentLocale={currentLocale}
                  />
                </div>
                <LocalizedClientLink
                  href="/"
                  className="min-w-0 text-[#211d19]"
                  data-testid="nav-store-link"
                >
                  <span className="font-display block truncate text-base tracking-[0.1em] xsmall:text-lg xsmall:tracking-[0.17em] small:text-xl small:tracking-[0.2em]">
                    PARFUMERIE
                  </span>
                  <span className="mt-0.5 hidden text-[7px] uppercase tracking-[0.34em] text-[#867568] small:block">
                    Selected scents
                  </span>
                </LocalizedClientLink>
              </div>

              <div className="hidden small:block">
                <NavSearch />
              </div>

              <div className="ml-auto flex shrink-0 items-center justify-end gap-1 text-xs text-[#51483f] xsmall:gap-3 small:ml-0 medium:gap-6">
                <WishlistLink />
                <Suspense
                  fallback={
                    <LocalizedClientLink
                      href="/cart"
                      data-testid="nav-cart-link"
                    >
                      Кошница (0)
                    </LocalizedClientLink>
                  }
                >
                  <CartButton />
                </Suspense>
                <AccountMenu customer={customer} />
              </div>
            </div>

            <div className="pb-3 small:hidden">
              <NavSearch />
            </div>
          </div>
        </div>

        <div className="relative h-px bg-[#9c846f]" aria-hidden="true">
          <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-[#9c846f] bg-[#e5d8cc]" />
        </div>

        <nav
          aria-label="Основна навигация"
          className="hidden bg-[#fffdf9] small:block"
        >
          <div className="content-container flex h-12 items-center justify-center gap-12 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#51483f]">
            {navigationItems.map(([label, href]) => (
              <LocalizedClientLink
                key={label}
                href={href}
                className="flex h-full items-center border-b-2 border-transparent pt-0.5 transition hover:border-[#8d735f] hover:text-black"
              >
                {label}
              </LocalizedClientLink>
            ))}
          </div>
        </nav>
      </header>
    </div>
  )
}
