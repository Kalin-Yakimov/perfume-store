import { toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import { useParams } from "react-router-dom"

import PerfumeProfileEditor from "../../../components/perfume-profile-editor"
import { adminRequest } from "../../../components/perfume-taxonomy-manager"
import UnifiedDecantsManager from "../../../components/unified-decants-manager"
import PerfumeForm, { type FullPerfume } from "../perfume-form"

type EditTab = "basic" | "stock" | "profile" | "decants"

const EditFullPerfumePage = () => {
  const { id } = useParams<{ id: string }>()
  const [product, setProduct] = useState<FullPerfume | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<EditTab>("basic")
  const [receivedQuantity, setReceivedQuantity] = useState("")
  const [isReceiving, setIsReceiving] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    try {
      const result = await adminRequest<{ product: FullPerfume }>(
        `/admin/full-perfumes/${id}`
      )
      setProduct(result.product)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Парфюмът не се зареди."
      )
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (isLoading) {
    return <p className="text-ui-fg-subtle px-6 py-8 text-sm">Зареждане…</p>
  }

  if (!product) {
    return (
      <section className="bg-ui-bg-base rounded-lg border px-6 py-8">
        <h1 className="text-lg font-semibold">Парфюмът не беше намерен</h1>
        <a href="/app/full-perfumes" className="mt-3 inline-block text-sm underline">
          Към списъка
        </a>
      </section>
    )
  }

  const isMultiVariant = (product.variants?.length || 0) > 1
  const tabs: { id: EditTab; label: string; description: string }[] = [
    { id: "basic", label: "Основни данни", description: "Бутилка, цена и видимост" },
    { id: "stock", label: "Наличност", description: "Получени запечатани бутилки" },
    { id: "profile", label: "Ароматен профил", description: "Сезони, нотки и акорди" },
    { id: "decants", label: "Отливки", description: "5 и 10 мл от тази бутилка" },
  ]
  const levels = product.variants?.[0]?.inventory_items?.flatMap(
    (item) => item.inventory?.location_levels || []
  ) || []
  const stockedQuantity = levels.reduce(
    (total, level) => total + level.stocked_quantity,
    0
  )
  const reservedQuantity = levels.reduce(
    (total, level) => total + level.reserved_quantity,
    0
  )

  const receiveStock = async () => {
    const quantity = Number(receivedQuantity)
    if (!Number.isInteger(quantity) || quantity <= 0) {
      toast.error("Въведете цяло положително число бутилки.")
      return
    }
    setIsReceiving(true)
    try {
      await adminRequest(`/admin/full-perfumes/${product.id}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ received_quantity: quantity }),
      })
      setReceivedQuantity("")
      toast.success(`${quantity} запечатани бутилки са добавени.`)
      await load()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Наличността не беше обновена."
      )
    } finally {
      setIsReceiving(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border px-6 py-5">
        <a href="/app/full-perfumes" className="text-ui-fg-subtle text-sm underline">
          ← Всички парфюми
        </a>
        <h1 className="mt-3 text-xl font-semibold">{product.title}</h1>
        <p className="text-ui-fg-subtle mt-1 text-sm">
          Всички настройки за този парфюм са събрани в разделите по-долу.
        </p>
      </section>

      <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border">
        <div className="grid gap-px overflow-hidden rounded-lg bg-ui-border-base sm:grid-cols-2 xl:grid-cols-4">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? "step" : undefined}
              className={`bg-ui-bg-base px-5 py-4 text-left ${
                activeTab === tab.id ? "ring-ui-border-interactive ring-inset ring-2" : ""
              }`}
            >
              <span className="block text-sm font-semibold">
                {index + 1}. {tab.label}
              </span>
              <span className="text-ui-fg-subtle mt-0.5 block text-xs">
                {tab.description}
              </span>
            </button>
          ))}
        </div>
      </section>

      {activeTab === "basic" && (
        <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border px-6 py-4 text-sm">
          <p className="font-medium">Наличност на запечатаните бутилки</p>
          <p className="text-ui-fg-subtle mt-1">
            Първоначалният брой е записан при създаването. За нова доставка или
            корекция отворете раздел „Наличност“. Отливките се изчисляват от
            тези бутилки автоматично.
          </p>
          <button
            type="button"
            onClick={() => setActiveTab("stock")}
            className="text-ui-fg-interactive mt-2 underline"
          >
            Към наличността →
          </button>
        </section>
      )}

      {activeTab === "basic" && (
        isMultiVariant ? (
          <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border px-6 py-5 text-sm">
            <h2 className="font-semibold">Този запис има няколко разфасовки</h2>
            <p className="text-ui-fg-subtle mt-2">
              Опростената форма редактира парфюми с една цяла разфасовка. За
              този по-стар запис използвайте подробната страница на продукта.
              Нищо няма да бъде променено автоматично.
            </p>
            <a
              href={`/app/products/${product.id}`}
              className="text-ui-fg-interactive mt-3 inline-block underline"
            >
              Отвори подробната страница →
            </a>
          </section>
        ) : (
          <PerfumeForm key={product.id} product={product} onSaved={setProduct} />
        )
      )}

      {activeTab === "stock" && (
        isMultiVariant ? (
          <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border px-6 py-5 text-sm">
            <h2 className="font-semibold">Наличност на няколко разфасовки</h2>
            <p className="text-ui-fg-subtle mt-2">
              Този по-стар продукт има няколко варианта. За да не добавим
              бутилките към грешна разфасовка, използвайте подробната му страница.
            </p>
            <a href={`/app/products/${product.id}`} className="text-ui-fg-interactive mt-3 inline-block underline">
              Отвори вариантите →
            </a>
          </section>
        ) : (
          <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border">
            <div className="border-b px-6 py-4">
              <h2 className="font-semibold">Запечатани бутилки</h2>
              <p className="text-ui-fg-subtle mt-1 text-sm">
                Отчитат се цели, все още неотворени бутилки. Когато бутилка се
                отвори за изпълнение на поръчка с отливки, тя се изважда оттук,
                но остатъкът ѝ остава проследим в раздел „Отливки“.
              </p>
            </div>
            <div className="grid gap-4 px-6 py-5 sm:grid-cols-3">
              <div className="bg-ui-bg-subtle rounded-md border p-4">
                <p className="text-ui-fg-subtle text-sm">В склада</p>
                <p className="mt-1 text-2xl font-semibold">{stockedQuantity}</p>
              </div>
              <div className="bg-ui-bg-subtle rounded-md border p-4">
                <p className="text-ui-fg-subtle text-sm">Заделени за поръчки</p>
                <p className="mt-1 text-2xl font-semibold">{reservedQuantity}</p>
              </div>
              <div className="bg-ui-bg-subtle rounded-md border p-4">
                <p className="text-ui-fg-subtle text-sm">Свободни</p>
                <p className="mt-1 text-2xl font-semibold">
                  {Math.max(0, stockedQuantity - reservedQuantity)}
                </p>
              </div>
            </div>
            <div className="border-t px-6 py-5">
              <h3 className="font-medium">Получена нова доставка</h3>
              <p className="text-ui-fg-subtle mt-1 text-sm">
                Въведете само новопристигналите бутилки. Числото ще се добави
                към текущата наличност, няма да я замени.
              </p>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="received-quantity" className="mb-1.5 block text-sm font-medium">
                    Брой нови бутилки
                  </label>
                  <input
                    id="received-quantity"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={receivedQuantity}
                    onChange={(event) => setReceivedQuantity(event.target.value)}
                    placeholder="Например 10"
                    className="bg-ui-bg-field text-ui-fg-base border-ui-border-base h-9 w-44 rounded-md border px-3 text-sm outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void receiveStock()}
                  disabled={isReceiving}
                  className="bg-ui-button-inverted text-ui-fg-on-inverted shadow-buttons-inverted h-9 rounded-md px-4 text-sm font-medium disabled:opacity-50"
                >
                  {isReceiving ? "Записване…" : "Добави към наличността"}
                </button>
              </div>
              <a
                href={`/app/products/${product.id}`}
                className="text-ui-fg-subtle mt-5 inline-block text-xs underline"
              >
                Разширени складови корекции
              </a>
            </div>
          </section>
        )
      )}

      {activeTab === "profile" && (
        <PerfumeProfileEditor
          product={{
            id: product.id,
            title: product.title,
            handle: product.handle || null,
            metadata: product.metadata,
          }}
          showCatalogVisibility={false}
          compactForFullPerfume
          onSaved={(saved) =>
            setProduct((current) =>
              current
                ? {
                    ...current,
                    title: saved.title,
                    handle: saved.handle,
                    metadata: saved.metadata,
                  }
                : current
            )
          }
        />
      )}

      {activeTab === "decants" && (
        <UnifiedDecantsManager
          product={{
            id: product.id,
            title: product.title,
            handle: product.handle || null,
            metadata: product.metadata,
            variants: product.variants,
          }}
        />
      )}

      {activeTab !== "basic" && (
        <div className="flex justify-end pb-6">
          <a
            href={`/app/products/${product.id}`}
            className="text-ui-fg-subtle text-xs underline"
          >
            Разширени настройки на продукта
          </a>
        </div>
      )}
    </div>
  )
}

export default EditFullPerfumePage
