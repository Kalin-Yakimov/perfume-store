"use client"

import { useRouter } from "next/navigation"

export default function CatalogError({ reset }: { reset: () => void }) {
  const router = useRouter()
  return (
    <div className="content-container py-16" role="alert">
      <h1 className="font-display text-3xl text-[#211d19]">
        Каталогът временно не е достъпен
      </h1>
      <p className="mt-4 text-sm text-[#806e60]">
        Не успяхме да заредим продуктите. Това не означава, че няма налични
        парфюми. Опитайте отново след малко.
      </p>
      <button
        type="button"
        onClick={() => {
          router.refresh()
          reset()
        }}
        className="mt-6 border border-[#211d19] px-6 py-3 text-sm text-[#211d19] transition hover:bg-[#f3eee8]"
      >
        Опитай отново
      </button>
    </div>
  )
}
