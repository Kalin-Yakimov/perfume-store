"use client"

import { useParams } from "next/navigation"
import { signout } from "@lib/data/customer"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const accountLinks = [
  ["/account", "Общ преглед"],
  ["/account/profile", "Профил"],
  ["/account/addresses", "Адреси"],
  ["/account/orders", "Поръчки"],
]

export default function AccountMenu({
  customer,
}: {
  customer: HttpTypes.StoreCustomer | null
}) {
  const { countryCode } = useParams() as { countryCode: string }
  const firstName = customer?.first_name?.trim()
  const displayName = firstName || "Профил"

  return (
    <details className="group relative">
      <summary
        className="inline-flex h-10 max-w-[190px] cursor-pointer list-none items-center gap-2 rounded-full px-2 text-[#51483f] transition hover:bg-[#eee8df] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8d735f] small:px-3 [&::-webkit-details-marker]:hidden"
        aria-label={
          customer ? `Меню на профила: ${displayName}` : "Меню за вход"
        }
        data-testid="nav-account-link"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-[18px] w-[18px] shrink-0"
        >
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5.5 20c.7-4 2.8-6 6.5-6s5.8 2 6.5 6" />
        </svg>
        <span className="hidden truncate text-xs xsmall:inline">
          {customer ? displayName : "Вход"}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="hidden h-3 w-3 shrink-0 transition group-open:rotate-180 xsmall:block"
        >
          <path d="m5 7.5 5 5 5-5" />
        </svg>
      </summary>

      {customer ? (
        <div className="absolute right-0 top-full z-[60] mt-2 w-[min(19rem,calc(100vw-2rem))] overflow-hidden border border-[#ded7cf] bg-[#fffdf9] text-[#211d19] shadow-[0_16px_40px_rgba(33,29,25,0.16)]">
          <div className="border-b border-[#ded7cf] bg-[#eee8df] px-5 py-4">
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#826c5a]">
              Вашият профил
            </p>
            <p className="mt-1 truncate font-display text-xl">
              {firstName ? `Здравей, ${firstName}` : "Добре дошли"}
            </p>
            {customer.email && (
              <p className="mt-1 truncate text-xs text-[#71665c]">
                {customer.email}
              </p>
            )}
          </div>
          <nav aria-label="Меню на профила" className="p-2">
            {accountLinks.map(([href, label], index) => (
              <LocalizedClientLink
                key={href}
                href={href}
                className={`block px-3 py-2.5 text-sm transition hover:bg-[#f1ece5] ${
                  index === 0 ? "font-semibold" : ""
                }`}
              >
                {label}
              </LocalizedClientLink>
            ))}
          </nav>
          <div className="border-t border-[#ded7cf] p-2">
            <form action={signout.bind(null, countryCode)}>
              <button
                type="submit"
                className="w-full px-3 py-2.5 text-left text-sm text-[#71665c] transition hover:bg-[#f1ece5] hover:text-[#211d19]"
                data-testid="logout-button"
              >
                Изход от профила
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="absolute right-0 top-full z-[60] mt-2 w-[min(19rem,calc(100vw-2rem))] border border-[#ded7cf] bg-[#fffdf9] p-5 text-[#211d19] shadow-[0_16px_40px_rgba(33,29,25,0.16)]">
          <p className="font-display text-xl">Добре дошли</p>
          <p className="mt-1 text-sm leading-6 text-[#71665c]">
            Влезте, за да прегледате поръчките, адресите и любимите си аромати.
          </p>
          <LocalizedClientLink
            href="/account"
            className="mt-4 flex min-h-11 items-center justify-center bg-[#211d19] px-4 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#4a4037]"
          >
            Вход в профила
          </LocalizedClientLink>
          <p className="mt-4 text-center text-xs text-[#71665c]">
            Нов клиент?{" "}
            <LocalizedClientLink
              href="/account?view=register"
              className="font-semibold text-[#211d19] underline underline-offset-4"
            >
              Създайте профил
            </LocalizedClientLink>
          </p>
        </div>
      )}
    </details>
  )
}
