import { Select, toast } from "@medusajs/ui"
import { FormEvent, useEffect, useMemo, useState } from "react"

import {
  adminRequest,
  type TaxonomyItem,
} from "../../components/perfume-taxonomy-manager"

export type PerfumeVariant = {
  id: string
  title: string
  sku: string | null
  metadata: Record<string, unknown> | null
  prices?: { currency_code: string; amount: number }[]
  inventory_items?: {
    inventory?: {
      location_levels?: {
        stocked_quantity: number
        reserved_quantity: number
      }[]
    }
  }[]
}

export type FullPerfume = {
  id: string
  title: string
  handle?: string | null
  description?: string | null
  status: string
  thumbnail?: string | null
  metadata: Record<string, unknown> | null
  variants?: PerfumeVariant[]
}

type PerfumeFormProps = {
  product?: FullPerfume
  onSaved: (product: FullPerfume) => void
}

const concentrations = [
  "Парфюмен екстракт",
  "Парфюмна вода",
  "Тоалетна вода",
  "Одеколон",
  "Парфюмно масло",
  "Спрей за тяло",
]

const genders = ["Мъжки", "Женски", "Унисекс"]
const EMPTY_SELECT_VALUE = "__empty__"

const recordValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const stringValue = (value: unknown) =>
  typeof value === "string" ? value : ""

const perfumeNameOf = (product?: FullPerfume) => {
  if (!product) return ""
  const storedName = stringValue(product.metadata?.perfume_name)
  if (storedName) return storedName
  const oldDesigner = stringValue(product.metadata?.brand)
  return oldDesigner && product.title.toLocaleLowerCase("bg").startsWith(`${oldDesigner.toLocaleLowerCase("bg")} `)
    ? product.title.slice(oldDesigner.length).trim()
    : product.title
}

const numberValue = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? String(value) : ""

export const volumeOf = (product: FullPerfume) => {
  const variant = product.variants?.[0]
  const value = Number(variant?.metadata?.volume_ml)
  if (Number.isFinite(value) && value > 0) return value
  const match = `${variant?.title || ""} ${variant?.sku || ""}`.match(/(\d+(?:[.,]\d+)?)\s*ml/i)
  return match ? Number(match[1].replace(",", ".")) : null
}

export const priceOf = (product: FullPerfume) => {
  const price = product.variants?.[0]?.prices?.find(
    (item) => item.currency_code === "eur"
  )?.amount
  return typeof price === "number" ? price : null
}

export const designerIdOf = (product: FullPerfume) => {
  const profile = recordValue(product.metadata?.perfume_profile)
  return stringValue(profile.designer_id)
}

const uploadImage = async (file: File) => {
  const data = new FormData()
  data.append("files", file)
  const result = await adminRequest<{ files: { url: string }[] }>(
    "/admin/uploads",
    { method: "POST", body: data }
  )
  const url = result.files[0]?.url
  if (!url) {
    throw new Error("Снимката не беше качена. Опитайте отново.")
  }
  return url
}

const PerfumeForm = ({ product, onSaved }: PerfumeFormProps) => {
  const profile = recordValue(product?.metadata?.perfume_profile)
  const [designers, setDesigners] = useState<TaxonomyItem[]>([])
  const [name, setName] = useState(perfumeNameOf(product))
  const [designerId, setDesignerId] = useState(
    product ? designerIdOf(product) : ""
  )
  const [concentration, setConcentration] = useState(
    stringValue(profile.concentration)
  )
  const [gender, setGender] = useState(stringValue(profile.gender))
  const [volumeMl, setVolumeMl] = useState(
    product ? numberValue(volumeOf(product)) : ""
  )
  const [priceEur, setPriceEur] = useState(
    product ? numberValue(priceOf(product)) : ""
  )
  const [initialQuantity, setInitialQuantity] = useState("0")
  const [description, setDescription] = useState(product?.description || "")
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [catalogVisible, setCatalogVisible] = useState(
    product?.metadata?.catalog_visible === true
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingDesigners, setIsLoadingDesigners] = useState(true)

  useEffect(() => {
    let active = true
    void adminRequest<{ items: TaxonomyItem[] }>(
      "/admin/perfume-taxonomies?kind=designer"
    )
      .then((result) => {
        if (active) setDesigners(result.items)
      })
      .catch((error) => {
        if (active) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Дизайнерските къщи не се заредиха."
          )
        }
      })
      .finally(() => {
        if (active) setIsLoadingDesigners(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!image) {
      setImagePreview(null)
      return
    }
    const url = URL.createObjectURL(image)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  const selectedDesigner = useMemo(
    () => designers.find((item) => item.id === designerId),
    [designerId, designers]
  )

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const volume = Number(volumeMl.replace(",", "."))
    const price = Number(priceEur.replace(",", "."))
    const quantity = Number(initialQuantity)

    if (!name.trim() || !designerId || !concentration || !gender) {
      toast.error("Попълнете името, дизайнерската къща, концентрацията и пола.")
      return
    }
    if (!Number.isInteger(volume) || volume <= 5) {
      toast.error("Обемът трябва да е цяло число над 5 мл.")
      return
    }
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Въведете валидна цена в евро.")
      return
    }
    if (!product && (!Number.isInteger(quantity) || quantity < 0)) {
      toast.error("Наличността трябва да е цяло число от 0 нагоре.")
      return
    }

    setIsSaving(true)
    try {
      const imageUrl = image ? await uploadImage(image) : undefined
      const payload = {
        name: name.trim(),
        designer_id: designerId,
        concentration,
        gender,
        volume_ml: volume,
        price_eur: price,
        description: description.trim(),
        ...(imageUrl ? { image_url: imageUrl } : {}),
        ...(product
          ? { catalog_visible: catalogVisible }
          : { initial_quantity: quantity }),
      }
      const result = await adminRequest<{ product: FullPerfume }>(
        product ? `/admin/full-perfumes/${product.id}` : "/admin/full-perfumes",
        {
          method: product ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      toast.success(
        product ? "Промените са записани." : "Парфюмът е създаден като чернова."
      )
      onSaved(result.product)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Парфюмът не беше записан."
      )
    } finally {
      setIsSaving(false)
    }
  }

  const fieldClass =
    "bg-ui-bg-field text-ui-fg-base border-ui-border-base h-9 w-full rounded-md border px-3 text-sm outline-none focus:border-ui-border-interactive"
  const labelClass = "mb-1.5 block text-sm font-medium"

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold">1. Кой парфюм продавате?</h2>
          <p className="text-ui-fg-subtle mt-1 text-sm">
            Въведете името без марката и милилитрите. Те се показват отделно.
          </p>
        </div>
        <div className="grid gap-5 px-6 py-5 md:grid-cols-2">
          <div>
            <label htmlFor="perfume-designer" className={labelClass}>
              Дизайнерска къща <span aria-hidden="true">*</span>
            </label>
            <Select
              value={designerId || EMPTY_SELECT_VALUE}
              onValueChange={(value) =>
                setDesignerId(value === EMPTY_SELECT_VALUE ? "" : value)
              }
            >
              <Select.Trigger id="perfume-designer" className="w-full">
                <Select.Value
                  placeholder={
                    isLoadingDesigners ? "Зареждане…" : "Изберете дизайнерска къща"
                  }
                />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value={EMPTY_SELECT_VALUE}>Не е избрана</Select.Item>
                {designers.map((designer) => (
                  <Select.Item key={designer.id} value={designer.id}>
                    {designer.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            {!isLoadingDesigners && !designers.length && (
              <p className="text-ui-fg-subtle mt-2 text-xs">
                Първо добавете марка в раздел „Дизайнерски къщи“.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="perfume-name" className={labelClass}>
              Име на парфюма <span aria-hidden="true">*</span>
            </label>
            <input
              id="perfume-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например Asad Elixir"
              className={fieldClass}
              required
            />
            {selectedDesigner && name.trim() && (
              <p className="text-ui-fg-subtle mt-1 text-xs">
                В магазина: {selectedDesigner.name} {name.trim()}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="perfume-concentration" className={labelClass}>
              Концентрация <span aria-hidden="true">*</span>
            </label>
            <Select
              value={concentration || EMPTY_SELECT_VALUE}
              onValueChange={(value) =>
                setConcentration(value === EMPTY_SELECT_VALUE ? "" : value)
              }
            >
              <Select.Trigger id="perfume-concentration" className="w-full">
                <Select.Value placeholder="Изберете концентрация" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value={EMPTY_SELECT_VALUE}>Не е избрана</Select.Item>
                {concentrations.map((value) => (
                  <Select.Item key={value} value={value}>
                    {value}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
          <div>
            <label htmlFor="perfume-gender" className={labelClass}>
              Пол <span aria-hidden="true">*</span>
            </label>
            <Select
              value={gender || EMPTY_SELECT_VALUE}
              onValueChange={(value) =>
                setGender(value === EMPTY_SELECT_VALUE ? "" : value)
              }
            >
              <Select.Trigger id="perfume-gender" className="w-full">
                <Select.Value placeholder="Изберете пол" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value={EMPTY_SELECT_VALUE}>Не е избран</Select.Item>
                {genders.map((value) => (
                  <Select.Item key={value} value={value}>
                    {value}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="perfume-description" className={labelClass}>
              Описание <span className="text-ui-fg-subtle font-normal">(по желание)</span>
            </label>
            <textarea
              id="perfume-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Кратко описание за клиента"
              className="bg-ui-bg-field text-ui-fg-base border-ui-border-base w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-ui-border-interactive"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="perfume-image" className={labelClass}>
              Снимка на парфюма <span className="text-ui-fg-subtle font-normal">(по желание)</span>
            </label>
            <div className="flex flex-wrap items-center gap-4">
              <div className="bg-ui-bg-subtle flex h-28 w-28 items-center justify-center overflow-hidden rounded-md border">
                {imagePreview || product?.thumbnail ? (
                  <img
                    src={imagePreview || product?.thumbnail || ""}
                    alt="Преглед на снимката"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-ui-fg-muted px-2 text-center text-xs">
                    Няма снимка
                  </span>
                )}
              </div>
              <div className="min-w-[220px] flex-1">
                <input
                  id="perfume-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setImage(event.target.files?.[0] || null)}
                  className="text-ui-fg-base block w-full text-sm"
                />
                <p className="text-ui-fg-subtle mt-2 text-xs">
                  Качете файл от компютъра. Снимката се съхранява от магазина,
                  без външен линк.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border">
        <div className="border-b px-6 py-4">
          <h2 className="font-semibold">2. Разфасовка, цена и наличност</h2>
          <p className="text-ui-fg-subtle mt-1 text-sm">
            Милилитрите се записват като отделно число към бутилката. Не е нужно
            да ги пишете в име, заглавие на вариант или SKU.
          </p>
        </div>
        <div className="grid gap-5 px-6 py-5 md:grid-cols-3">
          <div>
            <label htmlFor="perfume-volume" className={labelClass}>
              Обем на цялата бутилка (мл) <span aria-hidden="true">*</span>
            </label>
            <input
              id="perfume-volume"
              type="number"
              min="6"
              step="1"
              inputMode="numeric"
              value={volumeMl}
              onChange={(event) => setVolumeMl(event.target.value)}
              placeholder="100"
              className={fieldClass}
              required
            />
          </div>
          <div>
            <label htmlFor="perfume-price" className={labelClass}>
              Цена на цялата бутилка (€) <span aria-hidden="true">*</span>
            </label>
            <input
              id="perfume-price"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={priceEur}
              onChange={(event) => setPriceEur(event.target.value)}
              placeholder="29.00"
              className={fieldClass}
              required
            />
          </div>
          {!product && (
            <div>
              <label htmlFor="perfume-quantity" className={labelClass}>
                Запечатани бутилки в склада
              </label>
              <input
                id="perfume-quantity"
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={initialQuantity}
                onChange={(event) => setInitialQuantity(event.target.value)}
                className={fieldClass}
                required
              />
              <p className="text-ui-fg-subtle mt-1 text-xs">
                Ако още не са пристигнали, оставете 0.
              </p>
            </div>
          )}
          {product && (
            <p className="text-ui-fg-subtle self-end text-sm">
              След създаването промяната на наличността се прави в склада.
              Обемът и цената се редактират тук.
            </p>
          )}
        </div>
      </section>

      {product && (
        <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border">
          <div className="border-b px-6 py-4">
            <h2 className="font-semibold">3. Видимост в магазина</h2>
          </div>
          <div className="px-6 py-5">
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={catalogVisible}
                onChange={(event) => setCatalogVisible(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium">Показвай на клиентите</span>
                <span className="text-ui-fg-subtle mt-1 block">
                  Включете, когато снимката, цената, ароматният профил и
                  наличността са готови. Можете да скриете обявата отново,
                  без да я изтривате.
                </span>
              </span>
            </label>
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pb-6">
        <a href="/app/full-perfumes" className="text-ui-fg-subtle text-sm underline">
          Към списъка
        </a>
        <button
          type="submit"
          disabled={isSaving || isLoadingDesigners || !designers.length}
          className="bg-ui-button-inverted text-ui-fg-on-inverted shadow-buttons-inverted rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {isSaving
            ? "Записване…"
            : product
              ? "Запази промените"
              : "Създай скрита чернова"}
        </button>
      </div>
    </form>
  )
}

export default PerfumeForm
