"use client"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useParams, useRouter } from "next/navigation"
import { formatProductTitle } from "@lib/util/format-volume-for-display"
import { getPricesForVariant } from "@lib/util/get-product-price"
import { getDecantCatalogAvailability } from "@lib/data/decant-stock"
import { getRegion } from "@lib/data/regions"
import { FormEvent, useEffect, useRef, useState } from "react"

type SearchVariant = HttpTypes.StoreProductVariant & {
  calculated_price?: {
    calculated_amount: number
    original_amount: number
    currency_code: string
    calculated_price: { price_list_type: string }
  }
}

type SearchProduct = Pick<
  HttpTypes.StoreProduct,
  "id" | "title" | "handle" | "thumbnail" | "metadata"
> & { variants?: SearchVariant[] }
type SearchResult = SearchProduct & { unavailable: boolean }

const variantVolume = (variant: SearchVariant) => {
  const storedVolume = Number(variant.metadata?.volume_ml)
  if (Number.isFinite(storedVolume) && storedVolume > 0) {
    return `${storedVolume} мл`
  }

  const optionText =
    variant.options?.map((option) => option.value).join(" ") || ""
  const match = `${variant.title || ""} ${optionText}`.match(
    /(\d+(?:[.,]\d+)?)\s*(?:ml|мл)/i,
  )
  return match ? `${match[1]} мл` : ""
}

const variantDetails = (product: SearchProduct, unavailable: boolean) => {
  const variants = product.variants || []
  const details = variants
    .map((variant) => {
      const volume = variantVolume(variant)
      const price = getPricesForVariant(variant)
      if (!volume) return null

      return {
        volume,
        text: unavailable
          ? volume
          : `${volume}${price ? ` · ${price.calculated_price}` : ""}`,
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

const productIsUnavailable = (
  product: SearchProduct,
  decantAvailability: Record<string, boolean> | null,
) => {
  if (product.metadata?.listing_type === "decant") {
    // Match the catalog: when the decant stock endpoint is temporarily
    // unavailable, don't incorrectly mark the result as sold out.
    return decantAvailability?.[product.id] === false
  }

  return !(product.variants || []).some(
    (variant) =>
      !variant.manage_inventory ||
      variant.allow_backorder ||
      (variant.inventory_quantity || 0) > 0,
  )
}

export default function NavSearch() {
  const router = useRouter()
  const { countryCode } = useParams<{ countryCode: string }>()
  const containerRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  const [products, setProducts] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

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

    if (searchTerm.length < 2) {
      setProducts([])
      setIsLoading(false)
      return () => {
        active = false
      }
    }

    setIsLoading(true)

    const timer = window.setTimeout(async () => {
      try {
        const region = await getRegion(countryCode)
        if (!region) {
          if (active) {
            setProducts([])
            setIsOpen(true)
          }
          return
        }

        const response = await sdk.client.fetch<{
          products: SearchProduct[]
        }>("/store/products", {
          method: "GET",
          query: {
            q: searchTerm,
            limit: 100,
            region_id: region.id,
            fields:
              "id,title,handle,thumbnail,+variants.title,*variants.calculated_price,+variants.inventory_quantity,+variants.manage_inventory,+variants.allow_backorder,+variants.metadata,*variants.images,*variants.options,+metadata,+tags",
          },
          cache: "no-store",
        })

        const decantIds = response.products
          .filter((product) => product.metadata?.listing_type === "decant")
          .map((product) => product.id)
        const decantAvailability = await getDecantCatalogAvailability(decantIds)
        const sorted = response.products
          .map((product) => ({
            product,
            unavailable: productIsUnavailable(product, decantAvailability),
          }))
          .sort((a, b) => Number(a.unavailable) - Number(b.unavailable))
          .slice(0, 6)

        if (active) {
          setProducts(
            sorted.map(({ product, unavailable }) => ({
              ...product,
              unavailable,
            })),
          )
          setIsOpen(true)
        }
      } catch {
        if (active) {
          setProducts([])
          setIsOpen(true)
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [countryCode, query])

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const searchTerm = query.trim()

    if (!searchTerm) {
      return
    }

    setIsOpen(false)
    router.push(`/${countryCode}/parfyumi?q=${encodeURIComponent(searchTerm)}`)
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
                      `/${countryCode}/parfyumi?q=${encodeURIComponent(query.trim())}`,
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
