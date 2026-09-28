export type WishlistItem = {
  id: string
  handle: string
  title: string
  thumbnail?: string | null
  brand?: string
  concentration?: string
  gender?: string
  volume?: string
  price?: string
  availability?: "available" | "unavailable" | "unknown"
  listingType?: "decant" | "full_perfume"
}

export const WISHLIST_STORAGE_KEY = "parfumerie-wishlist"
export const WISHLIST_UPDATED_EVENT = "parfumerie-wishlist-updated"

export const getWishlist = (): WishlistItem[] => {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const storedWishlist = window.localStorage.getItem(WISHLIST_STORAGE_KEY)
    return storedWishlist ? JSON.parse(storedWishlist) : []
  } catch {
    return []
  }
}

export const toggleWishlistItem = (item: WishlistItem) => {
  const currentWishlist = getWishlist()
  const isSaved = currentWishlist.some((savedItem) => savedItem.id === item.id)
  const nextWishlist = isSaved
    ? currentWishlist.filter((savedItem) => savedItem.id !== item.id)
    : [...currentWishlist, item]

  window.localStorage.setItem(
    WISHLIST_STORAGE_KEY,
    JSON.stringify(nextWishlist)
  )
  window.dispatchEvent(new Event(WISHLIST_UPDATED_EVENT))

  return !isSaved
}

/** Refresh the stored product snapshot only when the item is already saved. */
export const syncWishlistItem = (item: WishlistItem) => {
  const current = getWishlist()
  const index = current.findIndex((savedItem) => savedItem.id === item.id)
  if (index < 0) return

  const next = [...current]
  next[index] = { ...next[index], ...item }
  if (JSON.stringify(next[index]) === JSON.stringify(current[index])) return

  window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event(WISHLIST_UPDATED_EVENT))
}
