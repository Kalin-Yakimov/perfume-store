import { Metadata } from "next"
import ForgotPassword from "@modules/account/components/forgot-password"

export const metadata: Metadata = {
  title: "Забравена парола",
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-[50vh] items-center justify-center bg-[#fbf9f6] px-4 py-12 small:py-16">
      <ForgotPassword />
    </main>
  )
}
