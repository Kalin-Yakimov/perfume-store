import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocation, useParams } from "react-router-dom"

import { adminRequest } from "../components/perfume-taxonomy-manager"

type Allocation = {
  id: string
  source_product_id: string
  source_title: string
  volume_ml: number
  status: "reserved" | "prepared" | "released"
  bottle_kind: "open" | "planned"
  bottle_id: string
}

const DecantOrderPreparationWidget = () => {
  const params = useParams<{ id?: string; order_id?: string }>()
  const location = useLocation()
  const orderId = params.id || params.order_id || location.pathname.split("/").filter(Boolean).at(-1)
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPreparing, setIsPreparing] = useState(false)

  const load = useCallback(async () => {
    if (!orderId) return
    setIsLoading(true)
    try {
      const result = await adminRequest<{ allocations: Allocation[] }>(
        `/admin/orders/${orderId}/decants`
      )
      setAllocations(result.allocations)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Отливките не можаха да се заредят.")
    } finally {
      setIsLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => {
    const grouped = new Map<string, { key: string; title: string; volumeMl: number; status: Allocation["status"]; quantity: number }>()
    for (const allocation of allocations) {
      const key = `${allocation.source_product_id}:${allocation.volume_ml}:${allocation.status}`
      const item = grouped.get(key) || {
        key,
        title: allocation.source_title,
        volumeMl: allocation.volume_ml,
        status: allocation.status,
        quantity: 0,
      }
      item.quantity++
      grouped.set(key, item)
    }
    return [...grouped.values()]
  }, [allocations])

  const pending = allocations.filter((item) => item.status === "reserved")
  const plannedBottles = new Set(
    pending.filter((item) => item.bottle_kind === "planned").map((item) => item.bottle_id)
  ).size

  const prepare = async () => {
    if (!orderId) return
    setIsPreparing(true)
    try {
      const result = await adminRequest<{ prepared_vials: number; opened_bottles: number }>(
        `/admin/orders/${orderId}/decants`,
        { method: "POST" }
      )
      toast.success(
        result.prepared_vials
          ? `Приготвени са ${result.prepared_vials} отливки. Отворени бутилки: ${result.opened_bottles}.`
          : "Отливките вече са приготвени."
      )
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Отливките не можаха да се приготвят.")
    } finally {
      setIsPreparing(false)
    }
  }

  if (isLoading || !allocations.length) return null

  return (
    <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border">
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">Отливки по поръчката</h2>
        <p className="text-ui-fg-subtle mt-1 text-sm">
          Отливките се наливат при подготовката на поръчката. Заделените цели бутилки се отварят и отчитат автоматично.
        </p>
      </div>
      <div className="divide-y">
        {rows.map((row) => (
          <div key={row.key} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 text-sm">
            <span className="font-medium">{row.title} · {row.volumeMl} мл × {row.quantity}</span>
            <span className="text-ui-fg-subtle">
              {row.status === "reserved" ? "За приготвяне" : row.status === "prepared" ? "Приготвени" : "Освободени"}
            </span>
          </div>
        ))}
      </div>
      {pending.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
          <p className="text-ui-fg-subtle text-sm">
            {pending.length} отливки за приготвяне
            {plannedBottles > 0 ? ` · ${plannedBottles} заделени цели бутилки` : ""}
          </p>
          <button
            type="button"
            disabled={isPreparing}
            onClick={() => void prepare()}
            className="bg-ui-button-inverted shadow-buttons-inverted h-8 rounded-md px-3 text-sm text-white disabled:opacity-50"
          >
            {isPreparing ? "Приготвяне…" : "Приготви отливките"}
          </button>
        </div>
      )}
    </section>
  )
}

export const config = defineWidgetConfig({
  id: "perfume-store.decant-order-preparation",
  zone: "order.details.after",
})

export default DecantOrderPreparationWidget
