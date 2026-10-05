"use client"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useParams, useRouter } from "next/navigation"
import { formatProductTitle } from "@lib/util/format-volume-for-display"
import { convertToLocale } from "@lib/util/money"
import {
  getCustomerVariants,
  getVariantVolumeLabel,
} from "@lib/util/customer-variants"
import { getRegion } from "@lib/data/regions"
import { resolveProductTaxonomy } from "@lib/util/product-taxonomy"
import { listPerfumeTaxonomies } from "@lib/data/perfume-taxonomies"
import { FormEvent, useEffect, useRef, useState } from "react"

type SearchVariant = HttpTypes.StoreProductVariant

type SearchProduct = Pick<
  HttpTypes.StoreProduct,
  "id" | "title" | "handle" | "thumbnail" | "metadata"
> & { variants?: SearchVariant[] | null }
type SearchResult = SearchProduct & { unavailable: boolean }

const variantDetails = (product: SearchProduct, unavailable: boolean) => {
  const variants = getCustomerVariants(product)
  const details = variants
    .map((variant) => {
      const volume = getVariantVolumeLabel(product, variant)
      const amount = variant.calculated_price?.calculated_amount
      const currency = variant.calculated_price?.currency_code
      const price =
        typeof amount === "number" && Number.isFinite(amount) && currency
          ? convertToLocale({ amount, currency_code: currency })
          : null
      if (!volume) return null

      return {
        volume,
        text: unavailable ? volume : `${volume}${price ? ` · ${price}` : ""}`,
        price:
          variant.calculated_price?.calculated_amount ??
          Number.MAX_SAFE_INTEGER,
      }
    })
    .filter((detail): detail is NonNullable<typeof detail> => Boolean(detail))
    .sort((a, b) => {
      const aVolume = Number.parseFloat(a.volume)
      const bVolume = Number.parseFloat(b.volume)
      return aVolume - bVolume || a.price - b.price
    })

  return Array.from(new Set(details.map((detail) => detail.text)))
}

export default function NavSearch() {
  const router = useRouter()
  const { countryCode } = useParams<{ countryCode: string }>()
  const countryPrefix = countryCode && countryCode !== "bg" ? `/${countryCode}` : ""
  const containerRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  const [products, setProducts] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleOutsideClick)

    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [])

  useEffect(() => {
    const searchTerm = query.trim()
    let active = true
    const controller = new AbortController()
    setHasError(false)

    if (searchTerm.length < 2) {
      setProducts([])
      setIsLoading(false)
      return () => {
        active = false
      }
    }

    setIsLoading(true)
    setIsOpen(true)

    const timer = window.setTimeout(async () => {
      try {
        const region = await getRegion(countryCode)
        if (!active) return
        if (!region) throw new Error("Search region is unavailable")

        const response = await sdk.client.fetch<{
          products: HttpTypes.StoreProduct[]
          unavailable_product_ids: string[]
        }>("/store/catalog", {
          query: { q: searchTerm, limit: 6, region_id: region.id },
          cache: "no-store",
          signal: controller.signal,
        })

        const taxonomies = response.products.some(
          (product) => product.metadata?.perfume_profile,
        ) ? await listPerfumeTaxonomies() : []
        const unavailableIds = new Set(response.unavailable_product_ids)

        if (active) {
          setProducts(
            response.products.map((product) => ({
              ...resolveProductTaxonomy(product, taxonomies),
              unavailable: unavailableIds.has(product.id),
            })),
          )
          setIsOpen(true)
        }
      } catch {
        if (active) {
          setProducts([])
          setHasError(true)
          setIsOpen(true)
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [countryCode, query, retry])

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const searchTerm = query.trim()

    if (!searchTerm) {
      return
    }

    setIsOpen(false)
    router.push(`${countryPrefix}/parfyumi?q=${encodeURIComponent(searchTerm)}`)
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={submitSearch} role="search" className="relative">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#75695f]"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => query.trim().length >= 2 && setIsOpen(true)}
          placeholder="Търси парфюм по име..."
          aria-label="Търси парфюм по име"
          className="h-11 w-full rounded-full border border-[#d7cec4] bg-white/70 pl-11 pr-12 text-sm outline-none transition focus:border-[#7d6d5e] focus:bg-white"
        />
        <button
          type="submit"
          aria-label="Търси"
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[#28231f] text-white transition hover:bg-[#59493d]"
        >
          <span aria-hidden="true">→</span>
        </button>
      </form>

      {isOpen && query.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-[70] overflow-hidden border border-[#ded7cf] bg-[#fffdf9] shadow-[0_18px_50px_rgba(45,34,25,0.16)]">
          {isLoading ? (
            <p className="px-5 py-5 text-sm text-[#74695f]">Търсене...</p>
          ) : hasError ? (
            <div className="px-5 py-5 text-sm text-[#74695f]" role="alert">
              <p>Търсенето временно не е достъпно. Опитайте отново.</p>
              <button
                type="button"
                onClick={() => setRetry((value) => value + 1)}
                className="mt-3 border border-[#211d19] px-4 py-2 text-[#211d19] transition hover:bg-[#f3eee8]"
              >
                Опитай отново
              </button>
            </div>
          ) : products.length ? (
            <ul>
              {products.map((product) => {
                const details = variantDetails(product, product.unavailable)

                return (
                  <li
                    key={product.id}
                    className="border-b border-[#eee8e1] last:border-0"
                  >
                    <LocalizedClientLink
                      href={`/products/${product.handle}`}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 transition hover:bg-[#f4efe9] ${product.unavailable ? "bg-[#f7f4f0] text-[#817a73]" : ""}`}
                    >
                      <div
                        className={`h-12 w-10 shrink-0 bg-[#ece7e0] bg-cover bg-center ${product.unavailable ? "grayscale opacity-60" : ""}`}
                        style={
                          product.thumbnail
                            ? { backgroundImage: `url(${product.thumbnail})` }
                            : undefined
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-sm font-medium ${product.unavailable ? "text-[#716b65]" : "text-[#302923]"}`}
                        >
                          {formatProductTitle(
                            product.title,
                            product.metadata?.listing_type === "decant",
                          )}
                        </span>
                        {!!details.length && (
                          <span
                            className={`mt-1 block truncate text-xs ${product.unavailable ? "text-[#938c84]" : "text-[#75695f]"}`}
                          >
                            {details.join("  /  ")}
                          </span>
                        )}
                      </span>
                      {product.unavailable ? (
                        <span className="shrink-0 bg-[#49443f] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-white">
                          Изчерпан
                        </span>
                      ) : (
                        <span className="text-[#8b7b6d]" aria-hidden="true">
                          →
                        </span>
                      )}
                    </LocalizedClientLink>
                  </li>
                )
              })}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    router.push(
                      `${countryPrefix}/parfyumi?q=${encodeURIComponent(query.trim())}`,
                    )
                  }}
                  className="w-full px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#66574b] transition hover:bg-[#f4efe9]"
                >
                  Виж всички резултати
                </button>
              </li>
            </ul>
          ) : (
            <p className="px-5 py-5 text-sm text-[#74695f]">
              Не открихме парфюм с това име.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
