/**
 * Cache policy for public Medusa data. Product data includes prices and a
 * stock snapshot, so it has a shorter lifetime than other catalog settings.
 * Transactional availability is checked separately with no-store requests.
 */
export const PUBLIC_CACHE_TTL = {
  products: 60,
  variants: 60,
  categories: 300,
  collections: 300,
  regions: 300,
  locales: 300,
  payment_providers: 300,
} as const

export type PublicCacheResource = keyof typeof PUBLIC_CACHE_TTL

export const getPublicCacheOptions = (
  resource: PublicCacheResource,
  isAuthenticated = false,
) => {
  if (process.env.NODE_ENV === "development" || isAuthenticated) {
    return { cache: "no-store" as const }
  }

  return {
    next: {
      revalidate: PUBLIC_CACHE_TTL[resource],
      // Public data is shared, so its tag must not vary by visitor cookie.
      tags: [resource],
    },
    cache: "force-cache" as const,
  }
}
