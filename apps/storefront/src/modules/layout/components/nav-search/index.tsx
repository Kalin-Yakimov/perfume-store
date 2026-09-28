"use client"

import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useParams, useRouter } from "next/navigation"
import { formatProductTitle } from "@lib/util/format-volume-for-display"
import { FormEvent, useEffect, useRef, useState } from "react"

type SearchProduct = Pick<
  HttpTypes.StoreProduct,
  "id" | "title" | "handle" | "thumbnail" | "metadata"
>

export default function NavSearch() {
  const router = useRouter()
  const { countryCode } = useParams<{ countryCode: string }>()
  const containerRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  const [products, setProducts] = useState<SearchProduct[]>([])
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

    if (searchTerm.length < 2) {
      setProducts([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    const timer = window.setTimeout(async () => {
      try {
        const response = await sdk.client.fetch<{
          products: SearchProduct[]
        }>("/store/products", {
          method: "GET",
          query: {
            q: searchTerm,
            limit: 6,
            fields: "id,title,handle,thumbnail,+metadata",
          },
          cache: "no-store",
        })

        setProducts(response.products)
        setIsOpen(true)
      } catch {
        setProducts([])
        setIsOpen(true)
      } finally {
        setIsLoading(false)
      }
    }, 250)

    return () => window.clearTimeout(timer)
  }, [query])

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
              {products.map((product) => (
                <li
                  key={product.id}
                  className="border-b border-[#eee8e1] last:border-0"
                >
                  <LocalizedClientLink
                    href={`/products/${product.handle}`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-4 px-4 py-3 transition hover:bg-[#f4efe9]"
                  >
                    <div
                      className="h-12 w-10 shrink-0 bg-[#ece7e0] bg-cover bg-center"
                      style={
                        product.thumbnail
                          ? { backgroundImage: `url(${product.thumbnail})` }
                          : undefined
                      }
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#302923]">
                      {formatProductTitle(
                        product.title,
                        product.metadata?.listing_type === "decant",
                      )}
                    </span>
                    <span className="text-[#8b7b6d]" aria-hidden="true">
                      →
                    </span>
                  </LocalizedClientLink>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    router.push(
                      `/${countryCode}/parfyumi?q=${encodeURIComponent(query.trim())}`
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
