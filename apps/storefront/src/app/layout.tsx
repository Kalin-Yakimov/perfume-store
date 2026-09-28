import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import "styles/globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  applicationName: "Parfumerie",
  title: {
    default: "Parfumerie | Подбрани аромати",
    template: "%s | Parfumerie",
  },
  description:
    "Онлайн парфюмерия с внимателно подбрани аромати за нея, за него и унисекс.",
  openGraph: {
    type: "website",
    locale: "bg_BG",
    siteName: "Parfumerie",
    title: "Parfumerie | Подбрани аромати",
    description:
      "Онлайн парфюмерия с внимателно подбрани аромати за нея, за него и унисекс.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Parfumerie | Подбрани аромати",
    description:
      "Онлайн парфюмерия с внимателно подбрани аромати за нея, за него и унисекс.",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="bg" data-mode="light">
      <body className="bg-[#fbf9f6] text-[#211d19] antialiased">
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
