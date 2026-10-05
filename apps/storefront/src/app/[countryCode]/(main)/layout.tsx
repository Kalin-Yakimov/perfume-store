import { Metadata } from "next"
import { Suspense } from "react"

import { getBaseURL } from "@lib/util/env"
import {
  CartMismatchNotification,
  CartShippingNudge,
} from "@modules/layout/components/cart-decorations"
import Footer from "@modules/layout/templates/footer"
import Nav from "@modules/layout/templates/nav"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default function PageLayout(props: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <Suspense fallback={null}>
        <CartMismatchNotification />
      </Suspense>
      <Suspense fallback={null}>
        <CartShippingNudge />
      </Suspense>
      <main className="flex flex-1 flex-col">{props.children}</main>
      <Footer />
    </div>
  )
}
