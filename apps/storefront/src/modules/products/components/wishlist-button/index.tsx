"use client"

import {
  getWishlist,
  toggleWishlistItem,
  syncWishlistItem,
  WishlistItem,
  WISHLIST_STORAGE_KEY,
  WISHLIST_UPDATED_EVENT,
} from "@lib/util/wishlist"
import { useEffect, useState } from "react"

export default function WishlistButton({
  item,
  className = "",
  compact = false,
  bare = false,
}: {
  item: WishlistItem
  className?: string
  compact?: boolean
  bare?: boolean
}) {
  const [isSaved, setIsSaved] = useState(false)

  useEffect(() => {
    const syncWishlistState = () => {
      setIsSaved(getWishlist().some((savedItem) => savedItem.id === item.id))
    }
    syncWishlistState()
    syncWishlistItem(item)
    window.addEventListener(WISHLIST_UPDATED_EVENT, syncWishlistState)
    window.addEventListener("storage", syncWishlistState)
    return () => {
      window.removeEventListener(WISHLIST_UPDATED_EVENT, syncWishlistState)
      window.removeEventListener("storage", syncWishlistState)
    }
  }, [item])

  const toggleWishlist = () => {
    setIsSaved(toggleWishlistItem(item))
  }

  return (
    <button
      type="button"
      onClick={toggleWishlist}
      aria-pressed={isSaved}
      aria-label={isSaved ? "Премахни от любими" : "Добави в любими"}
      className={`flex ${compact ? "h-10 w-10" : "h-12 w-12"} shrink-0 items-center justify-center rounded-full transition ${bare ? "border-0 bg-transparent hover:bg-transparent" : "border border-[#cfc3b8] bg-[#fffdf9] hover:border-[#9d7d6b]"} ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill={isSaved ? "#c8343d" : "none"}
        stroke={isSaved ? "#c8343d" : "currentColor"}
        strokeWidth="1.6"
        className="h-[18px] w-[18px] transition-colors"
      >
        <path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6l1.2 1.2L12 21l7.6-7.6 1.2-1.2a5.4 5.4 0 0 0 0-7.6Z" />
      </svg>
    </button>
  )
}
