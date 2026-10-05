import "server-only"

import { retrieveCustomerSummary } from "@lib/data/customer-read"
import AccountMenu from "../account-menu"

export function AccountMenuLoading() {
  return (
    <span
      role="status"
      aria-label="Зареждане на профила"
      className="inline-flex h-10 max-w-[190px] items-center gap-2 rounded-full px-2 text-[#51483f] small:px-3"
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
      <span className="hidden truncate text-xs xsmall:inline">Профил</span>
      <span aria-hidden="true" className="hidden h-3 w-3 shrink-0 xsmall:block" />
    </span>
  )
}

export default async function AccountMenuServer() {
  const customer = await retrieveCustomerSummary()

  return <AccountMenu customer={customer} />
}
