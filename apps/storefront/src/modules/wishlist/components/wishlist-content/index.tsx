"use client"

import {
  getWishlist,
  toggleWishlistItem,
  WISHLIST_UPDATED_EVENT,
  WishlistItem,
} from "@lib/util/wishlist"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Image from "next/image"
import { formatProductTitle } from "@lib/util/format-volume-for-display"
import { canOptimizeImage } from "@lib/util/image-optimization"
import { useEffect, useState } from "react"

export default function WishlistContent() {
  const [items, setItems] = useState<WishlistItem[]>([])
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const refreshWishlist = () => {
      setItems(getWishlist())
      setIsReady(true)
    }

    refreshWishlist()
    window.addEventListener(WISHLIST_UPDATED_EVENT, refreshWishlist)
    window.addEventListener("storage", refreshWishlist)

    return () => {
      window.removeEventListener(WISHLIST_UPDATED_EVENT, refreshWishlist)
      window.removeEventListener("storage", refreshWishlist)
    }
  }, [])

  if (!isReady) {
    return <div className="content-container min-h-72 py-20" />
  }

  if (!items.length) {
    return (
      <section className="content-container py-20 text-center small:py-28">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          className="mx-auto h-12 w-12 text-[#9b8878]"
        >
          <path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6l1.2 1.2L12 21l7.6-7.6 1.2-1.2a5.4 5.4 0 0 0 0-7.6Z" />
        </svg>
        <h2 className="font-display mt-6 text-3xl">
          Все още нямате любими парфюми
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[#6c6259]">
          Натиснете сърцето в страницата на даден парфюм, за да го запазите тук.
        </p>
        <LocalizedClientLink
          href="/parfyumi"
          className="mt-8 inline-flex min-h-12 items-center bg-[#28231f] px-7 text-xs font-semibold uppercase tracking-[0.17em] text-white transition hover:bg-[#58483c]"
        >
          Разгледай парфюмите
        </LocalizedClientLink>
      </section>
    )
  }

  return (
    <section className="content-container py-10 small:py-14">
      <div className="grid grid-cols-2 gap-3 small:grid-cols-4 medium:grid-cols-5 large:grid-cols-6">
        {items.map((item) => {
          const unavailable = item.availability === "unavailable"
          const details = [item.concentration, item.gender, item.volume].filter(
            Boolean,
          )
          const title = formatProductTitle(
            item.title,
            item.listingType === "decant",
          )

          return (
            <article
              key={item.id}
              className={`border bg-[#fffdf9] p-2 ${unavailable ? "border-[#e4dfd9]" : "border-[#ded7cf]"}`}
            >
              <LocalizedClientLink href={`/products/${item.handle}`}>
                <div className="relative aspect-[4/5] overflow-hidden bg-[#eee8df]">
                  {item.thumbnail && (
                    <Image
                      src={item.thumbnail}
                      alt={title}
                      fill
                      unoptimized={!canOptimizeImage(item.thumbnail)}
                      className={`object-cover ${unavailable ? "grayscale opacity-65" : ""}`}
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                    />
                  )}
                  {unavailable && (
                    <span className="absolute bottom-2 left-2 bg-[#49443f] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-white">
                      Изчерпан
                    </span>
                  )}
                </div>
                {item.brand && (
                  <p className="mt-2 text-xs font-medium text-[#665c54]">
                    {item.brand}
                  </p>
                )}
                <h2 className="mt-0.5 line-clamp-2 min-h-10 text-sm font-semibold text-[#302a25]">
                  {title}
                </h2>
                {details.length > 0 ? (
                  <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-4 text-[#665c54]">
                    {details.join(" · ")}
                  </p>
                ) : (
                  <p className="mt-1 min-h-8 text-xs leading-4 text-[#806e60]">
                    Данните ще се обновят при следващо разглеждане.
                  </p>
                )}
              </LocalizedClientLink>
              <div
                className={`mt-2 min-h-7 border-t border-[#e5ded6] pt-2 text-sm font-bold ${unavailable ? "text-[#817a73]" : "text-[#302a25]"}`}
              >
                {unavailable ? (
                  <span className="text-xs font-semibold uppercase tracking-[0.1em]">
                    Няма наличност
                  </span>
                ) : item.price ? (
                  <span>{item.price}</span>
                ) : (
                  <span className="text-xs font-normal text-[#806e60]">
                    Цената ще се обнови при следващо разглеждане
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  toggleWishlistItem(item)
                  setItems(getWishlist())
                }}
                className="mt-3 inline-flex min-h-9 w-full items-center justify-center border border-[#bcae9f] bg-[#fbf9f6] px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#51483f] transition hover:border-[#2a241f] hover:bg-[#f0e9e1] hover:text-[#211d19]"
              >
                Премахни
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
