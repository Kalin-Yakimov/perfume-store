import { Metadata } from "next"
import { Suspense } from "react"
import ResetPassword from "@modules/account/components/reset-password"

export const metadata: Metadata = {
  title: "Нова парола",
  robots: { index: false, follow: false },
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-[50vh] items-center justify-center bg-[#fbf9f6] px-4 py-12 small:py-16">
      <Suspense fallback={<p className="text-sm text-[#71665c]">Зареждане…</p>}>
        <ResetPassword />
      </Suspense>
    </main>
  )
}
