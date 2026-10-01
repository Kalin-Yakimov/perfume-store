"use client"

export default function CartError({ reset }: { reset: () => void }) {
  return (
    <div className="content-container py-16">
      <h1 className="font-display text-3xl text-[#211d19]">
        Кошницата временно не е достъпна
      </h1>
      <p className="mt-4 text-sm text-[#806e60]">
        Не успяхме да заредим избраните продукти. Опитайте отново след малко.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 border border-[#211d19] px-6 py-3 text-sm text-[#211d19] transition hover:bg-[#f3eee8]"
      >
        Опитай отново
      </button>
    </div>
  )
}
