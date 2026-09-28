"use client"

import {
  getWishlist,
  WISHLIST_UPDATED_EVENT,
} from "@lib/util/wishlist"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useEffect, useState } from "react"

export default function WishlistLink() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const updateCount = () => setCount(getWishlist().length)
    updateCount()
    window.addEventListener(WISHLIST_UPDATED_EVENT, updateCount)
    window.addEventListener("storage", updateCount)
    return () => {
      window.removeEventListener(WISHLIST_UPDATED_EVENT, updateCount)
      window.removeEventListener("storage", updateCount)
    }
  }, [])

  return (
    <LocalizedClientLink
      className="inline-flex h-10 items-center gap-2 rounded-full px-2 transition hover:bg-[#eee8df] small:px-3"
      href="/wishlist"
      aria-label={`Любими (${count})`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="h-[18px] w-[18px]"
      >
        <path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6l1.2 1.2L12 21l7.6-7.6 1.2-1.2a5.4 5.4 0 0 0 0-7.6Z" />
      </svg>
      <span className="hidden medium:inline">Любими ({count})</span>
      <span className="medium:hidden">({count})</span>
    </LocalizedClientLink>
  )
}
