import { Metadata } from "next"

import WishlistContent from "@modules/wishlist/components/wishlist-content"

export const metadata: Metadata = {
  title: "Любими",
  description: "Запазени любими парфюми.",
}

export default function WishlistPage() {
  return (
    <div className="bg-[#fbf9f6]">
      <section className="border-b border-[#ded7cf] bg-[#eee8df] py-7 small:py-8">
        <div className="content-container">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#826c5a]">
            Вашата селекция
          </p>
          <h1 className="font-display mt-1 text-3xl tracking-[-0.02em] small:text-4xl">
            Любими
          </h1>
        </div>
      </section>

      <WishlistContent />
    </div>
  )
}
