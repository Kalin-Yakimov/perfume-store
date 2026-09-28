import { defineRouteConfig } from "@medusajs/admin-sdk"
import { toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"

import {
  adminRequest,
  type TaxonomyItem,
} from "../../components/perfume-taxonomy-manager"
import {
  designerIdOf,
  priceOf,
  volumeOf,
  type FullPerfume,
} from "./perfume-form"

const FullPerfumesPage = () => {
  const [products, setProducts] = useState<FullPerfume[]>([])
  const [designers, setDesigners] = useState<TaxonomyItem[]>([])
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [productResult, designerResult] = await Promise.all([
        adminRequest<{ products: FullPerfume[] }>("/admin/full-perfumes"),
        adminRequest<{ items: TaxonomyItem[] }>(
          "/admin/perfume-taxonomies?kind=designer"
        ),
      ])
      setProducts(productResult.products)
      setDesigners(designerResult.items)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Парфюмите не се заредиха."
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("bg")
    return [...products]
      .filter((product) =>
        !term ? true : product.title.toLocaleLowerCase("bg").includes(term)
      )
      .sort((a, b) => a.title.localeCompare(b.title, "bg"))
  }, [products, query])

  const designerName = (product: FullPerfume) => {
    const designer = designers.find((item) => item.id === designerIdOf(product))
    return designer?.name ||
      (typeof product.metadata?.brand === "string"
        ? product.metadata.brand
        : "Без дизайнерска къща")
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b px-6 py-5">
          <div>
            <h1 className="text-lg font-semibold">Парфюми</h1>
            <p className="text-ui-fg-subtle mt-1 max-w-2xl text-sm">
              Управлявайте целите бутилки от едно място. Отливките се създават
              към вече записан парфюм и не са отделен артикул за ръчно въвеждане.
            </p>
          </div>
          <a
            href="/app/full-perfumes/create"
            className="bg-ui-button-inverted text-ui-fg-on-inverted shadow-buttons-inverted rounded-md px-4 py-2 text-sm font-medium"
          >
            Добави парфюм
          </a>
        </div>
        <div className="bg-ui-bg-subtle grid gap-3 px-6 py-4 text-sm md:grid-cols-3">
          <div><span className="font-medium">1. Създайте</span><span className="text-ui-fg-subtle block">Основни данни, мл, цена и бройки.</span></div>
          <div><span className="font-medium">2. Допълнете</span><span className="text-ui-fg-subtle block">Ароматен профил и отливки.</span></div>
          <div><span className="font-medium">3. Покажете</span><span className="text-ui-fg-subtle block">Публикувайте, когато всичко е готово.</span></div>
        </div>
      </section>

      <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
          <div>
            <h2 className="font-semibold">Цели парфюми</h2>
            <p className="text-ui-fg-subtle text-sm">
              {isLoading ? "Зареждане…" : `${products.length} записа`}
            </p>
          </div>
          <label className="text-sm">
            <span className="sr-only">Търси парфюм</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Търси по име…"
              className="bg-ui-bg-field text-ui-fg-base border-ui-border-base h-9 min-w-56 rounded-md border px-3 outline-none"
            />
          </label>
        </div>
        {isLoading ? (
          <p className="text-ui-fg-subtle px-6 py-10 text-center text-sm">
            Зареждане на парфюмите…
          </p>
        ) : visibleProducts.length ? (
          <div className="divide-y">
            {visibleProducts.map((product) => {
              const volume = volumeOf(product)
              const price = priceOf(product)
              const isVisible =
                product.status === "published" &&
                product.metadata?.catalog_visible === true

              return (
                <div
                  key={product.id}
                  className="flex flex-wrap items-center gap-4 px-6 py-4"
                >
                  <div className="bg-ui-bg-subtle flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border">
                    {product.thumbnail ? (
                      <img
                        src={product.thumbnail}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-ui-fg-muted text-xs">Без снимка</span>
                    )}
                  </div>
                  <div className="min-w-52 flex-1">
                    <a
                      href={`/app/full-perfumes/${product.id}`}
                      className="font-medium hover:underline"
                    >
                      {product.title}
                    </a>
                    <p className="text-ui-fg-subtle mt-0.5 text-sm">
                      {designerName(product)} · {volume ? `${volume} мл` : "Обемът липсва"}
                      {price !== null ? ` · €${price.toFixed(2)}` : " · Без цена"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      isVisible
                        ? "bg-ui-tag-green-bg text-ui-tag-green-text"
                        : "bg-ui-bg-subtle text-ui-fg-subtle"
                    }`}
                  >
                    {isVisible ? "Видим в магазина" : "Скрит от клиентите"}
                  </span>
                  <a
                    href={`/app/full-perfumes/${product.id}`}
                    className="shadow-buttons-neutral rounded-md border px-3 py-1.5 text-sm"
                  >
                    Отвори
                  </a>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="font-medium">
              {query ? "Няма резултати за това търсене." : "Все още няма парфюми."}
            </p>
            {!query && (
              <a
                href="/app/full-perfumes/create"
                className="text-ui-fg-interactive mt-2 inline-block text-sm underline"
              >
                Добавете първия парфюм
              </a>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

export const config = defineRouteConfig({ label: "Парфюми" })

export default FullPerfumesPage
