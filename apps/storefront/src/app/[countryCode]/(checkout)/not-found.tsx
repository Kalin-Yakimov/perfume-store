import InteractiveLink from "@modules/common/components/interactive-link"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "404",
  description: "Страницата не беше намерена.",
}

export default async function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-3xl text-[#211d19]">
        Страницата не е намерена
      </h1>
      <p className="text-sm text-[#71665c]">
        Проверете адреса или се върнете към каталога.
      </p>
      <InteractiveLink href="/">Към парфюмите</InteractiveLink>
    </div>
  )
}
