import { Select, toast } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"

import { adminRequest } from "./perfume-taxonomy-manager"

const RESERVE_ML = 5

type ProductVariant = { id: string; title: string; sku: string | null; metadata?: Record<string, unknown> | null }
type Product = {
  id: string
  title: string
  handle: string | null
  metadata: Record<string, unknown> | null
  variants?: ProductVariant[]
}
type Bottle = {
  id: string
  source_variant_id: string
  source_volume_ml: number
  initial_ml: number
  remaining_ml: number
  reserved_ml: number
  free_ml: number
  status: "active" | "depleted"
  opened_at: string
}
type PlannedBottle = {
  id: string
  source_volume_ml: number
  usable_ml: number
  reserved_ml: number
}
type SettingsVariant = { volume_ml: 5 | 10; enabled: boolean; price_eur: string }

const defaultVariants: SettingsVariant[] = [
  { volume_ml: 5, enabled: true, price_eur: "" },
  { volume_ml: 10, enabled: true, price_eur: "" },
]

const parseVolume = (value: string) => {
  const match = value.match(/(\d+(?:[.,]\d+)?)\s*ml/i)
  return match ? Number(match[1].replace(",", ".")) : undefined
}

const bottleVolume = (variant: ProductVariant) => {
  const stored = Number(variant.metadata?.volume_ml)
  return Number.isFinite(stored) && stored > 0
    ? stored
    : parseVolume(`${variant.title} ${variant.sku || ""}`)
}

const readEnabledIds = (metadata: Record<string, unknown> | null) =>
  Array.isArray(metadata?.decant_enabled_variant_ids)
    ? metadata.decant_enabled_variant_ids.filter(
        (id): id is string => typeof id === "string"
      )
    : []

const priceFromVariant = (variant: any) => {
  const calculated = variant?.calculated_price?.calculated_amount
  const prices = variant?.prices
  const price = calculated ?? prices?.find((item: any) => item.currency_code === "eur")?.amount
  return typeof price === "number" ? String(price) : ""
}

const UnifiedDecantsManager = ({ product }: { product: Product }) => {
  const [decant, setDecant] = useState<any | null>(null)
  const [variants, setVariants] = useState<SettingsVariant[]>(defaultVariants)
  const [catalogVisible, setCatalogVisible] = useState(false)
  const [decantsEnabled, setDecantsEnabled] = useState(false)
  const [decantSourceVariantId, setDecantSourceVariantId] = useState("")
  const [bottles, setBottles] = useState<Bottle[]>([])
  const [plannedBottles, setPlannedBottles] = useState<PlannedBottle[]>([])
  const [selectedVariantId, setSelectedVariantId] = useState("")
  const [sourceVolume, setSourceVolume] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isOpening, setIsOpening] = useState(false)

  const load = useCallback(async () => {
    if (product.metadata?.listing_type === "decant") {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const [settings, stock] = await Promise.all([
        adminRequest<{ decant: any | null }>(`/admin/products/${product.id}/decants`),
        adminRequest<{ bottles: Bottle[]; planned_bottles: PlannedBottle[] }>(
          `/admin/decant-bottles?source_product_id=${product.id}`
        ),
      ])
      const linkedDecant = settings.decant
      setDecant(linkedDecant)
      setBottles(stock.bottles)
      setPlannedBottles(stock.planned_bottles || [])
      if (!linkedDecant) {
        setDecantsEnabled(false)
        setCatalogVisible(false)
        setDecantSourceVariantId(product.variants?.length === 1 ? product.variants[0].id : "")
        setVariants(defaultVariants)
        return
      }
      const enabledIds = readEnabledIds(linkedDecant.metadata)
      const linkedVariants = linkedDecant.variants || []
      setDecantsEnabled(linkedDecant.metadata?.decant_enabled !== false)
      setCatalogVisible(linkedDecant.metadata?.catalog_visible === true)
      setDecantSourceVariantId(
        typeof linkedDecant.metadata?.decant_source_variant_id === "string" &&
          product.variants?.some(
            (variant) => variant.id === linkedDecant.metadata.decant_source_variant_id
          )
          ? linkedDecant.metadata.decant_source_variant_id
          : product.variants?.length === 1
            ? product.variants[0].id
            : ""
      )
      setVariants(
        ([5, 10] as const).map((volume) => {
          const linkedVariant = linkedVariants.find(
            (variant: ProductVariant) => parseVolume(variant.title) === volume
          )
          return {
            volume_ml: volume,
            enabled: linkedVariant ? enabledIds.includes(linkedVariant.id) : false,
            price_eur: priceFromVariant(linkedVariant),
          }
        })
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Отливките не можаха да се заредят.")
    } finally {
      setIsLoading(false)
    }
  }, [product.id, product.metadata?.listing_type, product.variants])

  useEffect(() => {
    void load()
  }, [load])

  const updateVariant = (volume: 5 | 10, change: Partial<SettingsVariant>) => {
    setVariants((current) =>
      current.map((variant) =>
        variant.volume_ml === volume ? { ...variant, ...change } : variant
      )
    )
  }

  const save = async () => {
    const enabledVariants = variants.filter((variant) => variant.enabled)
    if (decantsEnabled && !enabledVariants.length) {
      toast.error("Включете поне една разфасовка за отливка.")
      return
    }
    if (decantsEnabled && !decantSourceVariantId) {
      toast.error("Изберете цялата разфасовка, от която ще правите отливките.")
      return
    }
    if (
      decantsEnabled &&
      enabledVariants.some((variant) => Number(variant.price_eur.replace(",", ".")) <= 0)
    ) {
      toast.error("Въведете цена в евро за всяка включена разфасовка.")
      return
    }
    setIsSaving(true)
    try {
      const result = await adminRequest<{ decant: any }>(
        `/admin/products/${product.id}/decants`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled: decantsEnabled,
            catalog_visible: decantsEnabled && catalogVisible,
            source_variant_id: decantSourceVariantId,
            variants: variants.map((variant) => ({
              volume_ml: variant.volume_ml,
              enabled: decantsEnabled && variant.enabled,
              price_eur: Number(variant.price_eur.replace(",", ".")),
            })),
          }),
        }
      )
      setDecant(result.decant)
      toast.success(
        decantsEnabled
          ? "Отливките са запазени. Техническата обява се управлява автоматично."
          : "Отливките са спрени и скрити от клиентите."
      )
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Настройката не беше записана.")
    } finally {
      setIsSaving(false)
    }
  }

  const selectedFullVariant = useMemo(
    () => product.variants?.find((variant) => variant.id === selectedVariantId),
    [product.variants, selectedVariantId]
  )
  const decantSourceVariant = product.variants?.find(
    (variant) => variant.id === decantSourceVariantId
  )
  const decantSourceVolume = decantSourceVariant
    ? bottleVolume(decantSourceVariant)
    : undefined
  const usableMl = Number(sourceVolume) - RESERVE_ML

  const selectFullVariant = (variantId: string) => {
    setSelectedVariantId(variantId)
    const variant = product.variants?.find((item) => item.id === variantId)
    const volume = variant ? bottleVolume(variant) : undefined
    setSourceVolume(volume ? String(volume) : "")
  }

  const openBottle = async () => {
    if (!selectedVariantId || !Number.isFinite(Number(sourceVolume)) || usableMl <= 0) {
      toast.error("Изберете разфасовка и въведете валиден обем на бутилката.")
      return
    }
    setIsOpening(true)
    try {
      await adminRequest("/admin/decant-bottles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_product_id: product.id,
          source_variant_id: selectedVariantId,
          source_volume_ml: Number(sourceVolume),
        }),
      })
      toast.success(`Бутилката е отворена. Налични са ${usableMl} мл за отливки.`)
      setSelectedVariantId("")
      setSourceVolume("")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Бутилката не можа да се отвори.")
    } finally {
      setIsOpening(false)
    }
  }

  if (isLoading) return null

  if (product.metadata?.listing_type === "decant") {
    const sourceId = product.metadata.decant_source_product_id
    return (
      <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border px-6 py-5">
        <h2 className="text-lg font-semibold">Отливка</h2>
        <p className="text-ui-fg-subtle mt-1 text-sm">
          Тази техническа обява се управлява от страницата на оригиналния цял парфюм.
        </p>
        {typeof sourceId === "string" && (
          <a href={`/app/products/${sourceId}`} className="text-ui-fg-interactive mt-3 inline-block text-sm underline">
            Отвори оригиналния парфюм
          </a>
        )}
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border">
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Отливки</h2>
          <p className="text-ui-fg-subtle mt-1 text-sm">
            Настройвате отливките директно към този парфюм. Системата сама създава и поддържа обявата в каталога „Отливки“.
          </p>
        </div>
        <div className="flex max-w-3xl flex-col gap-4 px-6 py-5">
          <label className="flex items-start gap-3 rounded-md border p-4">
            <input type="checkbox" className="mt-0.5" checked={decantsEnabled} onChange={(event) => setDecantsEnabled(event.target.checked)} />
            <span><span className="block text-sm font-medium">Предлагай този парфюм и като отливки</span><span className="text-ui-fg-subtle mt-1 block text-xs">При първото запазване се създават вариантите 5 мл и 10 мл автоматично.</span></span>
          </label>

          <div className="rounded-md border p-4">
            <p className="text-sm font-medium">Цяла бутилка за отливките</p>
            <p className="text-ui-fg-subtle mt-1 text-xs">Когато отворена бутилка не стига, системата използва налична запечатана бутилка от тази разфасовка.</p>
            {(product.variants || []).length === 1 ? (
              <p className="mt-3 text-sm font-medium">{decantSourceVolume ? `${decantSourceVolume} мл` : "Липсва зададен обем"}</p>
            ) : (
              <Select value={decantSourceVariantId} onValueChange={setDecantSourceVariantId} disabled={!decantsEnabled}>
                <Select.Trigger id="decant-source-variant" className="mt-3 w-full max-w-md"><Select.Value placeholder="Изберете разфасовка…" /></Select.Trigger>
                <Select.Content>
                  {(product.variants || []).map((variant) => (
                    <Select.Item key={variant.id} value={variant.id}>{bottleVolume(variant) ? `${bottleVolume(variant)} мл` : variant.title.replace(/(\d+(?:[.,]\d+)?)\s*ml\b/gi, "$1 мл")}</Select.Item>
                  ))}
                </Select.Content>
              </Select>
            )}
            <p className="text-ui-fg-subtle mt-3 text-xs">
              Обемът на бутилката се задава в полето „Обем на бутилката (мл)“ при създаване или редакция на парфюма.
              {decantSourceVariant && (decantSourceVolume
                ? ` Сега е разпознат обем ${decantSourceVolume} мл; за отливки ще се използват ${decantSourceVolume - RESERVE_ML} мл след технологичния резерв.`
                : " За избрания вариант още няма зададен обем — редактирайте парфюма преди записване на отливките.")}
            </p>
          </div>

          <div className="rounded-md border p-4">
            <p className="text-sm font-medium">Разфасовки и цени</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {variants.map((variant) => (
                <div key={variant.volume_ml} className="flex items-end gap-3 rounded-md border p-3">
                  <label className="flex flex-1 items-center gap-2 text-sm font-medium"><input type="checkbox" checked={variant.enabled} disabled={!decantsEnabled} onChange={(event) => updateVariant(variant.volume_ml, { enabled: event.target.checked })} /> {variant.volume_ml} мл</label>
                  <label className="flex w-32 flex-col gap-1 text-xs text-ui-fg-subtle">Цена, €<input type="number" min="0" step="0.01" disabled={!decantsEnabled || !variant.enabled} value={variant.price_eur} onChange={(event) => updateVariant(variant.volume_ml, { price_eur: event.target.value })} className="bg-ui-bg-field h-8 rounded-md border px-2 text-sm text-ui-fg-base outline-none disabled:opacity-50" /></label>
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-md border p-4">
            <input type="checkbox" className="mt-0.5" checked={catalogVisible} disabled={!decantsEnabled} onChange={(event) => setCatalogVisible(event.target.checked)} />
            <span><span className="block text-sm font-medium">Показвай в каталога „Отливки“</span><span className="text-ui-fg-subtle mt-1 block text-xs">Изключете го, докато оформяте цени или временно не искате да продавате отливки.</span></span>
          </label>

          <div className="flex items-center gap-3"><button type="button" disabled={isSaving} onClick={() => void save()} className="bg-ui-button-inverted shadow-buttons-inverted h-8 rounded-md px-3 text-sm text-white disabled:opacity-50">{isSaving ? "Записване…" : "Запази отливките"}</button>{decant?.handle && <a className="text-ui-fg-interactive text-sm underline" href={`/app/products/${decant.id}`}>Отвори техническата обява</a>}</div>
        </div>
      </section>

      <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border">
        <div className="border-b px-6 py-4"><h2 className="text-lg font-semibold">Бутилки за отливки</h2><p className="text-ui-fg-subtle mt-1 text-sm">При онлайн поръчка системата сама заделя цяла бутилка, ако е нужна. Отворете и отчетете бутилката от самата поръчка чрез „Приготви отливките“. Тук можете да отворите бутилка ръчно само за мостри или продажби извън сайта. Всяка бутилка има 5 мл технологичен резерв.</p></div>
        <div className="px-6 pt-5 text-sm">
          <p className="font-medium">Заделени, но още запечатани: {plannedBottles.length}</p>
          {plannedBottles.map((bottle) => <p key={bottle.id} className="text-ui-fg-subtle mt-1">Бутилка {bottle.source_volume_ml} мл · заделени {bottle.reserved_ml} мл · свободни {Math.max(0, bottle.usable_ml - bottle.reserved_ml)} мл за следващи поръчки</p>)}
        </div>
        <details className="border-t px-6 py-4">
          <summary className="cursor-pointer text-sm font-medium">Ръчно отваряне — мостри и продажби извън сайта</summary>
          <p className="text-ui-fg-subtle mt-2 text-xs">За онлайн поръчки бутилката се заделя автоматично. Използвайте тази операция само когато отваряте бутилка по друга причина.</p>
        <div className="grid gap-4 pt-4 md:grid-cols-[1fr_180px_auto] md:items-end">
          <label className="flex flex-col gap-2 text-sm font-medium">Ръчно отваряне — цяла разфасовка<Select value={selectedVariantId} onValueChange={selectFullVariant}><Select.Trigger className="w-full"><Select.Value placeholder="Изберете бутилка…" /></Select.Trigger><Select.Content>{(product.variants || []).map((variant) => <Select.Item key={variant.id} value={variant.id}>{variant.title}{variant.sku ? ` — ${variant.sku}` : ""}</Select.Item>)}</Select.Content></Select></label>
          <label className="flex flex-col gap-2 text-sm font-medium">Обем, мл<input type="number" min={RESERVE_ML + 0.01} step="0.01" value={sourceVolume} onChange={(event) => setSourceVolume(event.target.value)} className="bg-ui-bg-field h-8 rounded-md border px-2 text-sm outline-none" /></label>
          <button type="button" disabled={isOpening || !selectedFullVariant || usableMl <= 0} onClick={() => void openBottle()} className="bg-ui-button-inverted shadow-buttons-inverted h-8 rounded-md px-3 text-sm text-white disabled:opacity-50">{isOpening ? "Отваряне…" : usableMl > 0 ? `Отвори бутилка — ${usableMl} мл` : "Отвори бутилка"}</button>
        </div>
        </details>
        <div className="border-t px-6 py-4 text-sm">{bottles.length ? <div className="flex flex-col gap-2">{bottles.map((bottle) => <p key={bottle.id}><span className="font-medium">Остатък: {bottle.remaining_ml} мл</span> · заделени {bottle.reserved_ml} мл · свободни {bottle.free_ml} мл · отворена бутилка {bottle.source_volume_ml} мл · {bottle.status === "active" ? "активна" : "изчерпана"}</p>)}</div> : <p className="text-ui-fg-subtle">Все още няма отворена бутилка. Отливките могат да се поръчват и от налични запечатани бутилки в раздел „Наличност“.</p>}</div>
      </section>
    </div>
  )
}

export default UnifiedDecantsManager
