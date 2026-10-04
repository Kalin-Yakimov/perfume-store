import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Select, toast } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { adminSdk } from "../../lib/sdk"
import DataError from "../../components/data-error"

type Product = { id: string; title: string }

type DecantBottle = {
  id: string
  source_product_id: string
  source_variant_id: string
  source_volume_ml: number
  reserve_ml: number
  initial_ml: number
  remaining_ml: number
  reserved_ml: number
  free_ml: number
  status: "active" | "depleted"
  opened_at: string
}
type PlannedBottle = {
  id: string
  source_product_id: string
  source_volume_ml: number
  usable_ml: number
  reserved_ml: number
}

type AdjustmentDraft = {
  change_ml: string
  reason: "sale" | "sample" | "loss" | "correction"
  note: string
}

const emptyAdjustment: AdjustmentDraft = {
  change_ml: "",
  reason: "correction",
  note: "",
}

const DecantStockPage = () => {
  const [adjustments, setAdjustments] = useState<
    Record<string, AdjustmentDraft>
  >({})
  const [savingBottleId, setSavingBottleId] = useState<string | null>(null)

  const result = useQuery({
    queryKey: ["decant-bottles"],
    queryFn: () =>
      adminSdk.client.fetch<{
        products: Product[]
        bottles: DecantBottle[]
        planned_bottles: PlannedBottle[]
      }>("/admin/decant-bottles"),
    staleTime: 0,
    retry: false,
  })
  const bottles = result.data?.bottles || []
  const plannedBottles = result.data?.planned_bottles || []

  const productNames = useMemo(
    () =>
      new Map(
        result.data?.products.map((product) => [product.id, product.title]),
      ),
    [result.data],
  )

  const updateAdjustment = (
    bottleId: string,
    change: Partial<AdjustmentDraft>,
  ) => {
    setAdjustments((current) => ({
      ...current,
      [bottleId]: { ...(current[bottleId] || emptyAdjustment), ...change },
    }))
  }

  const saveAdjustment = async (bottleId: string) => {
    const adjustment = adjustments[bottleId] || emptyAdjustment
    const changeMl = Number(adjustment.change_ml.replace(",", "."))

    if (!Number.isFinite(changeMl) || changeMl === 0) {
      toast.error("Въведете промяната в милилитри. Например -5 за отливка.")
      return
    }

    setSavingBottleId(bottleId)
    try {
      await adminSdk.client.fetch(
        `/admin/decant-bottles/${bottleId}/adjustments`,
        {
          method: "POST",
          body: { ...adjustment, change_ml: changeMl },
        },
      )
      toast.success("Остатъкът е обновен.")
      setAdjustments((current) => ({ ...current, [bottleId]: emptyAdjustment }))
      await result.refetch()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Промяната не беше записана.",
      )
    } finally {
      setSavingBottleId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border">
        <div className="border-b px-6 py-4">
          <h1 className="text-lg font-semibold">
            Отливки — справка и корекции
          </h1>
          <p className="text-ui-fg-subtle mt-1 text-sm">
            Тук виждате всички отворени бутилки и правите само извънредни
            корекции. Онлайн поръчките автоматично заделят нужната бутилка;
            физическото отваряне се отчита от бутон „Приготви отливките“ в
            поръчката.
          </p>
        </div>
        <div className="bg-ui-bg-subtle px-6 py-4 text-sm">
          <p className="font-medium">
            Защо използваемият запас е с 5 мл по-малък?
          </p>
          <p className="text-ui-fg-subtle mt-1 max-w-3xl">
            От обема на всяка отворена бутилка системата изважда 5 мл. Например
            от 100 мл се продават 95 мл, а от 105 мл — 100 мл. Тези 5 мл са
            технологичен резерв за тестове, разливане и остатъка, който
            практически не може да бъде отлят.
          </p>
          <p className="text-ui-fg-subtle mt-2 max-w-3xl">
            При поръчка цялата бутилка първо се заделя в Inventory. Когато я
            отворите за приготвяне, тя се премества в списъка с отворени бутилки
            и наличността на запечатаните намалява с 1.
          </p>
        </div>
      </section>

      <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold">Заделени запечатани бутилки</h2>
        </div>
        {result.isPending ? (
          <p className="text-ui-fg-subtle px-6 py-5 text-sm" role="status">
            Зареждане…
          </p>
        ) : result.isError ? (
          <DataError
            title="Запасът не се зареди"
            onRetry={() => void result.refetch()}
            isRetrying={result.isFetching}
          />
        ) : plannedBottles.length ? (
          <div className="divide-y">
            {plannedBottles.map((bottle) => (
              <div key={bottle.id} className="px-6 py-4 text-sm">
                <p className="font-medium">
                  {productNames.get(bottle.source_product_id) || "Парфюм"} ·{" "}
                  {bottle.source_volume_ml} мл
                </p>
                <p className="text-ui-fg-subtle mt-1">
                  Използваеми {bottle.usable_ml} мл · заделени за поръчки{" "}
                  {bottle.reserved_ml} мл · свободни за следващи отливки{" "}
                  {Math.max(0, bottle.usable_ml - bottle.reserved_ml)} мл
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ui-fg-subtle px-6 py-5 text-sm">
            Няма заделени запечатани бутилки.
          </p>
        )}
      </section>

      <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold">Запас по отворени бутилки</h2>
        </div>
        {result.isPending ? (
          <p className="text-ui-fg-subtle px-6 py-5 text-sm" role="status">
            Зареждане…
          </p>
        ) : result.isError ? (
          <DataError
            title="Запасът не се зареди"
            onRetry={() => void result.refetch()}
            isRetrying={result.isFetching}
          />
        ) : bottles.length ? (
          <div className="divide-y">
            {bottles.map((bottle) => {
              const adjustment = adjustments[bottle.id] || emptyAdjustment
              return (
                <div
                  key={bottle.id}
                  className="flex flex-col gap-3 px-6 py-4 xl:flex-row xl:items-end xl:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {productNames.get(bottle.source_product_id) ||
                        "Изтрит продукт"}
                    </p>
                    <p className="text-ui-fg-subtle mt-1 text-sm">
                      Отворена на{" "}
                      {new Date(bottle.opened_at).toLocaleDateString("bg-BG")} ·
                      бутилка {bottle.source_volume_ml} мл · резерв{" "}
                      {bottle.reserve_ml} мл · използваеми {bottle.initial_ml}{" "}
                      мл
                    </p>
                    <p className="mt-2 text-sm">
                      <span className="font-medium">
                        Остатък: {bottle.remaining_ml} мл
                      </span>{" "}
                      · заделени {bottle.reserved_ml} мл · свободни{" "}
                      {bottle.free_ml} мл ·{" "}
                      {bottle.status === "active" ? "Активна" : "Изчерпана"}
                    </p>
                  </div>
                  {bottle.status === "active" && (
                    <div className="grid gap-2 sm:grid-cols-[130px_170px_minmax(180px,1fr)_auto]">
                      <input
                        value={adjustment.change_ml}
                        onChange={(event) =>
                          updateAdjustment(bottle.id, {
                            change_ml: event.target.value,
                          })
                        }
                        placeholder="Напр. -5 мл"
                        className="bg-ui-bg-field h-8 rounded-md border px-2 text-sm outline-none"
                      />
                      <Select
                        value={adjustment.reason}
                        onValueChange={(reason) =>
                          updateAdjustment(bottle.id, {
                            reason: reason as AdjustmentDraft["reason"],
                          })
                        }
                      >
                        <Select.Trigger className="w-full">
                          <Select.Value />
                        </Select.Trigger>
                        <Select.Content>
                          <Select.Item value="sale">
                            Ръчна продажба (офлайн)
                          </Select.Item>
                          <Select.Item value="sample">Тест</Select.Item>
                          <Select.Item value="loss">
                            Загуба / разливане
                          </Select.Item>
                          <Select.Item value="correction">Корекция</Select.Item>
                        </Select.Content>
                      </Select>
                      <input
                        value={adjustment.note}
                        onChange={(event) =>
                          updateAdjustment(bottle.id, {
                            note: event.target.value,
                          })
                        }
                        placeholder="Бележка (по желание)"
                        className="bg-ui-bg-field h-8 rounded-md border px-2 text-sm outline-none"
                      />
                      <button
                        type="button"
                        disabled={savingBottleId === bottle.id}
                        onClick={() => void saveAdjustment(bottle.id)}
                        className="shadow-buttons-neutral h-8 rounded-md border px-3 text-sm disabled:opacity-50"
                      >
                        Запази
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-ui-fg-subtle px-6 py-8 text-sm">
            Все още няма отворени бутилки за отливки.
          </p>
        )}
      </section>
    </div>
  )
}

export const config = defineRouteConfig({ label: "Отливки — запас" })

export default DecantStockPage
