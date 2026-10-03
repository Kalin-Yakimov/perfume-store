import React from "react"

import UnderlineLink from "@modules/common/components/interactive-link"

import AccountNav from "../components/account-nav"
import type { CustomerSummary } from "@lib/data/customer-types"

interface AccountLayoutProps {
  customer: CustomerSummary | null
  children: React.ReactNode
}

const AccountLayout: React.FC<AccountLayoutProps> = ({
  customer,
  children,
}) => {
  if (!customer) {
    return (
      <div className="flex flex-1 flex-col" data-testid="account-page">
        {children}
      </div>
    )
  }

  return (
    <div
      className="flex-1 bg-[#fbf9f6] py-8 small:py-12"
      data-testid="account-page"
    >
      <div className="content-container mx-auto flex h-full max-w-5xl flex-col">
        <div className="grid grid-cols-1 gap-8 py-6 small:grid-cols-[240px_1fr]">
          <div>
            <AccountNav customer={customer} />
          </div>
          <div className="flex-1">{children}</div>
        </div>
        <div className="flex flex-col items-start justify-between gap-6 border-t border-[#ded7cf] py-8 small:flex-row small:items-center">
          <div>
            <h3 className="font-display mb-2 text-xl">Имате въпроси?</h3>
            <span className="text-sm text-[#71665c]">
              Разгледайте информацията за поръчки, доставка и връщане.
            </span>
          </div>
          <div>
            <UnderlineLink href="/help">Помощ и информация</UnderlineLink>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AccountLayout
