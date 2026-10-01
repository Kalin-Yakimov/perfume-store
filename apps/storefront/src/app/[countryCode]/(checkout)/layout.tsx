import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ChevronDown from "@modules/common/icons/chevron-down"
import Footer from "@modules/layout/templates/footer"
import { Metadata } from "next"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#fbf9f6]">
      <header className="border-b border-[#d9ccbf] bg-[#f0e8df]">
        <nav className="content-container flex h-20 max-w-6xl items-center justify-between gap-4">
          <LocalizedClientLink
            href="/cart"
            className="flex flex-1 basis-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#51483f] transition hover:text-[#211d19]"
            data-testid="back-to-cart-link"
          >
            <ChevronDown className="rotate-90" size={16} />
            <span className="mt-px hidden small:block">
              Назад към кошницата
            </span>
            <span className="mt-px block small:hidden">Назад</span>
          </LocalizedClientLink>
          <LocalizedClientLink
            href="/"
            className="font-display text-xl tracking-[0.22em] text-[#211d19] transition hover:text-[#806e60] small:text-2xl"
            data-testid="store-link"
          >
            PARFUMERIE
          </LocalizedClientLink>
          <div className="flex-1 basis-0" />
        </nav>
      </header>
      <main className="relative flex-1" data-testid="checkout-container">
        {children}
      </main>
      <Footer />
    </div>
  )
}
