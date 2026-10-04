import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Button, Container, Heading, Input, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { adminSdk } from "../../lib/sdk"
import type { TaxonomyItem } from "../../components/perfume-taxonomy-manager"
import DataError from "../../components/data-error"
import {
  designerIdOf,
  priceOf,
  volumeOf,
  type FullPerfume,
} from "./perfume-form"

type ProductPage = {
  products: FullPerfume[]
  count: number
  offset: number
  limit: number
}
const PAGE_SIZE = 20

const FullPerfumesPage = () => {
  const [query, setQuery] = useState("")
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim())
      setOffset(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const result = useQuery({
    queryKey: ["full-perfumes", { search, offset }],
    queryFn: () =>
      adminSdk.client.fetch<ProductPage>("/admin/full-perfumes", {
        query: { q: search, offset, limit: PAGE_SIZE },
      }),
    // The dashboard's 90-second default would hide edits after returning here.
    staleTime: 0,
    retry: false,
  })
  const taxonomy = useQuery({
    queryKey: ["perfume-taxonomies", "designer"],
    queryFn: () =>
      adminSdk.client.fetch<{ items: TaxonomyItem[] }>(
        "/admin/perfume-taxonomies",
        { query: { kind: "designer" } },
      ),
    staleTime: 0,
    retry: false,
  })
  const total = result.data?.count || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const page = Math.floor(offset / PAGE_SIZE) + 1
  useEffect(() => {
    if (result.data && offset >= result.data.count && offset > 0) {
      setOffset(
        Math.max(0, Math.ceil(result.data.count / PAGE_SIZE) - 1) * PAGE_SIZE,
      )
    }
  }, [result.data, offset])
  const designers = new Map(
    taxonomy.data?.items.map((item) => [item.id, item.name]),
  )

  return (
    <div className="flex flex-col gap-4">
      <Container className="p-0">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b px-6 py-5">
          <div>
            <Heading>Парфюми</Heading>
            <Text className="text-ui-fg-subtle mt-1 max-w-2xl">
              Управлявайте целите бутилки от едно място. Отливките се настройват
              към вече записан парфюм.
            </Text>
          </div>
          <Button asChild>
            <a href="/app/full-perfumes/create">Добави парфюм</a>
          </Button>
        </div>
        <div className="bg-ui-bg-subtle grid gap-3 px-6 py-4 text-sm md:grid-cols-3">
          <div>
            <span className="font-medium">1. Създайте</span>
            <span className="text-ui-fg-subtle block">
              Основни данни, мл, цена и бройки.
            </span>
          </div>
          <div>
            <span className="font-medium">2. Допълнете</span>
            <span className="text-ui-fg-subtle block">
              Ароматен профил и отливки.
            </span>
          </div>
          <div>
            <span className="font-medium">3. Покажете</span>
            <span className="text-ui-fg-subtle block">
              Публикувайте, когато всичко е готово.
            </span>
          </div>
        </div>
      </Container>

      <Container className="p-0">
        {taxonomy.isError && (
          <DataError
            title="Дизайнерските къщи не се заредиха"
            onRetry={() => void taxonomy.refetch()}
            isRetrying={taxonomy.isFetching}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
          <div>
            <Heading level="h2">Цели парфюми</Heading>
            <Text className="text-ui-fg-subtle">
              {result.isPending
                ? "Зареждане…"
                : result.isError
                  ? "Списъкът не е зареден"
                  : `${total} записа`}
            </Text>
          </div>
          <Input
            type="search"
            aria-label="Търси парфюм"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Търси по име или марка…"
            className="max-w-xs"
          />
        </div>
        {result.isPending ? (
          <Text
            className="text-ui-fg-subtle px-6 py-10 text-center"
            role="status"
          >
            Зареждане на парфюмите…
          </Text>
        ) : result.isError ? (
          <DataError
            title="Парфюмите не се заредиха"
            onRetry={() => void result.refetch()}
            isRetrying={result.isFetching}
          />
        ) : result.data?.products.length ? (
          <div className="divide-y">
            {result.data.products.map((product) => {
              const volume = volumeOf(product)
              const price = priceOf(product)
              const designer =
                designers.get(designerIdOf(product)) ||
                (typeof product.metadata?.brand === "string"
                  ? product.metadata.brand
                  : "Без дизайнерска къща")
              const visible =
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
                      <span className="text-ui-fg-muted text-xs">
                        Без снимка
                      </span>
                    )}
                  </div>
                  <div className="min-w-52 flex-1">
                    <a
                      href={`/app/full-perfumes/${product.id}`}
                      className="font-medium hover:underline"
                    >
                      {product.title}
                    </a>
                    <Text className="text-ui-fg-subtle mt-0.5">
                      {designer} · {volume ? `${volume} мл` : "Обемът липсва"}
                      {price !== null
                        ? ` · €${price.toFixed(2)}`
                        : " · Без цена"}
                    </Text>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs ${visible ? "bg-ui-tag-green-bg text-ui-tag-green-text" : "bg-ui-bg-subtle text-ui-fg-subtle"}`}
                  >
                    {visible ? "Видим в магазина" : "Скрит от клиентите"}
                  </span>
                  <Button variant="secondary" asChild>
                    <a href={`/app/full-perfumes/${product.id}`}>Отвори</a>
                  </Button>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <Text>
              {search
                ? "Няма резултати за това търсене."
                : "Все още няма парфюми."}
            </Text>
            {!search && (
              <a
                href="/app/full-perfumes/create"
                className="text-ui-fg-interactive mt-2 inline-block text-sm underline"
              >
                Добавете първия парфюм
              </a>
            )}
          </div>
        )}
        {!result.isError && !result.isPending && totalPages > 1 && (
          <nav
            aria-label="Страници на парфюмите"
            className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4"
          >
            <Text className="text-ui-fg-subtle">
              Страница {page} от {totalPages}
            </Text>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={page <= 1 || result.isFetching}
                onClick={() => setOffset(offset - PAGE_SIZE)}
              >
                Предишна
              </Button>
              <Button
                variant="secondary"
                disabled={page >= totalPages || result.isFetching}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Следваща
              </Button>
            </div>
          </nav>
        )}
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({ label: "Парфюми" })
export default FullPerfumesPage
