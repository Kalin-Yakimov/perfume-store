import { Input, Popover, Select, toast } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"

import {
  adminRequest,
  TaxonomyItem,
} from "./perfume-taxonomy-manager"

export type AdminPerfumeProduct = {
  id: string
  title: string
  handle: string | null
  metadata: Record<string, unknown> | null
}

type StoredPerfumeProfile = {
  designer_id?: string
  concentration?: string
  tagline?: string
  seasons?: string[]
  longevity?: string
  sillage?: string
  gender?: string
  top_note_ids?: string[]
  heart_note_ids?: string[]
  base_note_ids?: string[]
  accord_ids?: string[]
}

type SelectionFieldProps = {
  id: string
  label: string
  placeholder: string
  items: TaxonomyItem[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

type PerfumeProfileEditorProps = {
  product: AdminPerfumeProduct
  onSaved?: (product: AdminPerfumeProduct) => void
  showCatalogVisibility?: boolean
  compactForFullPerfume?: boolean
}

type AdminSelectOption = {
  value: string
  label: string
}

type SearchableSelectProps = {
  id: string
  value: string
  placeholder: string
  options: AdminSelectOption[]
  onChange: (value: string) => void
  allowClear?: boolean
}

const EMPTY_SELECT_VALUE = "__perfume_store_empty__"

const AdminSelect = ({
  id,
  value,
  placeholder,
  options,
  onChange,
}: {
  id: string
  value: string
  placeholder: string
  options: AdminSelectOption[]
  onChange: (value: string) => void
}) => (
  <Select
    value={value || EMPTY_SELECT_VALUE}
    onValueChange={(nextValue) =>
      onChange(nextValue === EMPTY_SELECT_VALUE ? "" : nextValue)
    }
  >
    <Select.Trigger id={id} className="w-full">
      <Select.Value placeholder={placeholder} />
    </Select.Trigger>
    <Select.Content>
      <Select.Item value={EMPTY_SELECT_VALUE}>{placeholder}</Select.Item>
      {options.map((option) => (
        <Select.Item key={option.value} value={option.value}>
          {option.label}
        </Select.Item>
      ))}
    </Select.Content>
  </Select>
)

const SearchableSelect = ({
  id,
  value,
  placeholder,
  options,
  onChange,
  allowClear = false,
}: SearchableSelectProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selectedOption = options.find((option) => option.value === value)
  const normalizedQuery = query.trim().toLocaleLowerCase("bg")
  const filteredOptions = options.filter((option) =>
    option.label.toLocaleLowerCase("bg").includes(normalizedQuery)
  )

  const updateOpenState = (open: boolean) => {
    setIsOpen(open)
    setQuery("")
  }

  const selectOption = (nextValue: string) => {
    onChange(nextValue)
    updateOpenState(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={updateOpenState}>
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className="bg-ui-bg-field text-ui-fg-base flex h-8 w-full items-center justify-between gap-2 rounded-md border px-2.5 text-left text-sm outline-none focus-visible:shadow-borders-focus"
        >
          <span className={selectedOption ? "truncate" : "text-ui-fg-muted truncate"}>
            {selectedOption?.label || placeholder}
          </span>
          <span aria-hidden="true" className="text-ui-fg-muted shrink-0">
            ▾
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Content
        align="start"
        sideOffset={4}
        className="bg-ui-bg-base shadow-elevation-card-rest z-50 rounded-md border p-2"
        style={{ width: "var(--radix-popover-trigger-width)" }}
      >
        <Input
          autoFocus
          aria-label="Търсене в списъка"
          placeholder="Започнете да пишете за търсене…"
          size="small"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div
          role="listbox"
          aria-label={placeholder}
          className="mt-2 max-h-56 overflow-y-auto"
        >
          {allowClear && (
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => selectOption("")}
              className="text-ui-fg-subtle hover:bg-ui-bg-subtle w-full rounded px-2 py-1.5 text-left text-sm"
            >
              {placeholder}
            </button>
          )}
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => selectOption(option.value)}
              className="text-ui-fg-base hover:bg-ui-bg-subtle w-full rounded px-2 py-1.5 text-left text-sm"
            >
              {option.label}
            </button>
          ))}
          {!filteredOptions.length && (
            <p className="text-ui-fg-subtle px-2 py-2 text-sm" role="status">
              Няма намерени резултати.
            </p>
          )}
        </div>
      </Popover.Content>
    </Popover>
  )
}

const readStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []

const readString = (value: unknown) =>
  typeof value === "string" ? value : ""

const normalizeConcentration = (value: unknown) => {
  const concentration = readString(value)
  const translations: Record<string, string> = {
    "Parfum / Extrait de Parfum": "Парфюмен екстракт",
    "Eau de Parfum": "Парфюмна вода",
    "Eau de Toilette": "Тоалетна вода",
    "Eau de Cologne": "Одеколон",
  }
  return translations[concentration] || concentration
}

const readStoredProfile = (
  metadata: Record<string, unknown> | null
): StoredPerfumeProfile => {
  const value = metadata?.perfume_profile

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  const profile = value as Record<string, unknown>

  return {
    designer_id:
      typeof profile.designer_id === "string"
        ? profile.designer_id
        : undefined,
    concentration: normalizeConcentration(profile.concentration),
    tagline: readString(profile.tagline),
    seasons: readStringArray(profile.seasons),
    longevity: readString(profile.longevity),
    sillage: readString(profile.sillage),
    gender: readString(profile.gender),
    top_note_ids: readStringArray(profile.top_note_ids),
    heart_note_ids: readStringArray(profile.heart_note_ids),
    base_note_ids: readStringArray(profile.base_note_ids),
    accord_ids: readStringArray(profile.accord_ids),
  }
}

const SelectionField = ({
  id,
  label,
  placeholder,
  items,
  selectedIds,
  onChange,
}: SelectionFieldProps) => {
  const [pendingId, setPendingId] = useState("")
  const availableItems = items.filter((item) => !selectedIds.includes(item.id))

  const addItem = () => {
    if (!pendingId) {
      return
    }

    onChange([...selectedIds, pendingId])
    setPendingId("")
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex gap-2">
        <SearchableSelect
          id={id}
          value={pendingId}
          placeholder={placeholder}
          onChange={setPendingId}
          options={availableItems.map((item) => ({
            value: item.id,
            label: `${item.name}${
              item.original_name ? ` — ${item.original_name}` : ""
            }`,
          }))}
        />
        <button
          type="button"
          disabled={!pendingId}
          onClick={addItem}
          className="shadow-buttons-neutral h-8 rounded-md border px-3 text-sm disabled:opacity-50"
        >
          Добави
        </button>
      </div>

      {!!selectedIds.length && (
        <div className="flex flex-wrap gap-2 pt-1">
          {selectedIds.map((itemId) => {
            const item = items.find((entry) => entry.id === itemId)

            if (!item) {
              return null
            }

            return (
              <span
                key={item.id}
                className="bg-ui-bg-subtle inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs"
              >
                {item.name}
                <button
                  type="button"
                  aria-label={`Премахни ${item.name}`}
                  className="text-ui-fg-muted hover:text-ui-fg-base"
                  onClick={() =>
                    onChange(selectedIds.filter((value) => value !== item.id))
                  }
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

const PerfumeProfileEditor = ({
  product,
  onSaved,
  showCatalogVisibility = true,
  compactForFullPerfume = false,
}: PerfumeProfileEditorProps) => {
  const [taxonomyItems, setTaxonomyItems] = useState<TaxonomyItem[]>([])
  const [designerId, setDesignerId] = useState("")
  const [concentration, setConcentration] = useState("")
  const [tagline, setTagline] = useState("")
  const [seasons, setSeasons] = useState<string[]>([])
  const [longevity, setLongevity] = useState("")
  const [sillage, setSillage] = useState("")
  const [gender, setGender] = useState("")
  const [topNoteIds, setTopNoteIds] = useState<string[]>([])
  const [heartNoteIds, setHeartNoteIds] = useState<string[]>([])
  const [baseNoteIds, setBaseNoteIds] = useState<string[]>([])
  const [accordIds, setAccordIds] = useState<string[]>([])
  const [isCatalogVisible, setIsCatalogVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const designers = useMemo(
    () => taxonomyItems.filter((item) => item.kind === "designer"),
    [taxonomyItems]
  )
  const notes = useMemo(
    () => taxonomyItems.filter((item) => item.kind === "note"),
    [taxonomyItems]
  )
  const accords = useMemo(
    () => taxonomyItems.filter((item) => item.kind === "accord"),
    [taxonomyItems]
  )

  const isDecant = product.metadata?.listing_type === "decant"

  useEffect(() => {
    let isActive = true

    const loadTaxonomies = async () => {
      setIsLoading(true)
      try {
        const result = await adminRequest<{ items: TaxonomyItem[] }>(
          "/admin/perfume-taxonomies"
        )
        if (isActive) {
          setTaxonomyItems(result.items)
        }
      } catch (error) {
        if (isActive) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Грешка при зареждане на каталозите."
          )
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadTaxonomies()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    const profile = readStoredProfile(product.metadata)

    setDesignerId(profile.designer_id || "")
    setConcentration(profile.concentration || "")
    setTagline(profile.tagline || "")
    setSeasons(profile.seasons || [])
    setLongevity(profile.longevity || "")
    setSillage(profile.sillage || "")
    setGender(profile.gender || "")
    setTopNoteIds(profile.top_note_ids || [])
    setHeartNoteIds(profile.heart_note_ids || [])
    setBaseNoteIds(profile.base_note_ids || [])
    setAccordIds(profile.accord_ids || [])
    setIsCatalogVisible(product.metadata?.catalog_visible === true)
  }, [product.id, product.metadata])

  const saveProfile = async () => {
    const designer = designers.find((item) => item.id === designerId)
    const selectedNoteIds = [
      ...topNoteIds,
      ...heartNoteIds,
      ...baseNoteIds,
    ]
    const selectedNoteNames = selectedNoteIds
      .map((id) => notes.find((note) => note.id === id)?.name)
      .filter((name): name is string => Boolean(name))
    const selectedAccordNames = accordIds
      .map((id) => accords.find((accord) => accord.id === id)?.name)
      .filter((name): name is string => Boolean(name))
    const genderFilterValue =
      gender === "Мъжки"
        ? "male"
        : gender === "Женски"
          ? "female"
          : gender === "Унисекс"
            ? "unisex"
            : null

    setIsSaving(true)
    try {
      const result = await adminRequest<{ product: AdminPerfumeProduct }>(
        `/admin/products/${product.id}/perfume-profile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metadata: {
              ...(product.metadata || {}),
              listing_type: "full_perfume",
              // New perfume listings stay private until the administrator
              // explicitly decides that they are ready for the storefront.
              catalog_visible: showCatalogVisibility
                ? isCatalogVisible
                : product.metadata?.catalog_visible === true,
              brand: designer?.name || null,
              gender: genderFilterValue,
              seasons,
              perfume_notes: selectedNoteNames,
              perfume_accords: selectedAccordNames,
              perfume_profile: {
                designer_id: designerId || null,
                concentration,
                tagline,
                seasons,
                longevity,
                sillage,
                gender,
                top_note_ids: topNoteIds,
                heart_note_ids: heartNoteIds,
                base_note_ids: baseNoteIds,
                accord_ids: accordIds,
              },
            },
          }),
        }
      )

      onSaved?.(result.product)
      toast.success("Парфюмният профил е записан.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Профилът не беше записан."
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (isDecant) {
    return (
      <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border">
        <div className="px-6 py-4">
          <h2 className="text-lg font-semibold">Ароматен профил</h2>
          <p className="text-ui-fg-subtle mt-1 text-sm">
            Това е обява за отливка. Ароматният профил се взема от свързания
            цял парфюм и не се попълва повторно тук.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border">
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">Парфюмен профил</h2>
        <p className="text-ui-fg-subtle mt-1 text-sm">
          {compactForFullPerfume
            ? "Попълнете сезоните, трайността, проекцията, нотките и акордите. Името, дизайнерът, обемът и цената са в „Основни данни“."
            : "Тук се попълва ароматната информация за тази цяла бутилка. Снимките, вариантите, цените и наличността се управляват от стандартните полета на продукта над тази секция."}
        </p>
      </div>

      {isLoading ? (
        <p className="text-ui-fg-subtle px-6 py-5 text-sm">Зареждане…</p>
      ) : (
        <div className="flex flex-col gap-6 px-6 py-5">
          {showCatalogVisibility && <div className="max-w-xl rounded-md border border-ui-border-base bg-ui-bg-subtle p-4">
            <label
              htmlFor="catalog-visible"
              className="flex cursor-pointer items-start gap-3"
            >
              <input
                id="catalog-visible"
                type="checkbox"
                checked={isCatalogVisible}
                onChange={(event) => setIsCatalogVisible(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium">
                  Показвай продукта в каталога
                </span>
                <span className="text-ui-fg-subtle mt-1 block text-xs">
                  Ако е изключено, продуктът остава публикуван и запазен в
                  Medusa, но не се вижда от клиентите нито в каталога, нито
                  при директен линк.
                </span>
              </span>
            </label>
          </div>}

          {!compactForFullPerfume && <div className="flex max-w-xl flex-col gap-2">
            <label htmlFor="profile-designer" className="text-sm font-medium">
              Дизайнерска къща
            </label>
            <SearchableSelect
              id="profile-designer"
              value={designerId}
              placeholder="Не е избрана"
              onChange={setDesignerId}
              allowClear
              options={designers.map((designer) => ({
                value: designer.id,
                label: designer.name,
              }))}
            />
          </div>}

          <div className="grid gap-4 rounded-md border p-4 md:grid-cols-2 xl:grid-cols-4">
            {!compactForFullPerfume && <div className="flex flex-col gap-2">
              <label htmlFor="profile-concentration" className="text-sm font-medium">
                Концентрация
              </label>
              <AdminSelect
                id="profile-concentration"
                value={concentration}
                placeholder="Не е избрана"
                onChange={setConcentration}
                options={[
                  "Парфюмен екстракт",
                  "Парфюмна вода",
                  "Тоалетна вода",
                  "Одеколон",
                  "Парфюмно масло",
                  "Спрей за тяло",
                ].map((value) => ({ value, label: value }))}
              />
            </div>}

            {!compactForFullPerfume && <div className="flex flex-col gap-2">
              <label htmlFor="profile-gender" className="text-sm font-medium">
                Пол
              </label>
              <AdminSelect
                id="profile-gender"
                value={gender}
                placeholder="Не е избран"
                onChange={setGender}
                options={["Мъжки", "Женски", "Унисекс"].map((value) => ({
                  value,
                  label: value,
                }))}
              />
            </div>}

            <div className="flex flex-col gap-2">
              <label htmlFor="profile-longevity" className="text-sm font-medium">
                Трайност
              </label>
              <AdminSelect
                id="profile-longevity"
                value={longevity}
                placeholder="Не е избрана"
                onChange={setLongevity}
                options={[
                  "Слаба",
                  "Умерена",
                  "Дълготрайна",
                  "Много дълготрайна",
                ].map((value) => ({ value, label: value }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="profile-sillage" className="text-sm font-medium">
                Проекция
              </label>
              <AdminSelect
                id="profile-sillage"
                value={sillage}
                placeholder="Не е избрана"
                onChange={setSillage}
                options={[
                  "Интимна",
                  "Умерена",
                  "Силна",
                  "Много силна",
                ].map((value) => ({ value, label: value }))}
              />
            </div>

            <fieldset className="flex flex-col gap-2 md:col-span-2 xl:col-span-4">
              <legend className="text-sm font-medium">Подходящи сезони</legend>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {[
                  ["winter", "Зима"],
                  ["spring", "Пролет"],
                  ["summer", "Лято"],
                  ["autumn", "Есен"],
                ].map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={seasons.includes(value)}
                      onChange={(event) =>
                        setSeasons((current) =>
                          event.target.checked
                            ? [...current, value]
                            : current.filter((season) => season !== value)
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col gap-2 md:col-span-2 xl:col-span-4">
              <label htmlFor="profile-tagline" className="text-sm font-medium">
                Кратко описание на аромата
              </label>
              <textarea
                id="profile-tagline"
                value={tagline}
                rows={3}
                onChange={(event) => setTagline(event.target.value)}
                placeholder="Например: Топъл плодов аромат с мек мускус и сух дървесен финал."
                className="bg-ui-bg-field resize-y rounded-md border px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <SelectionField
              id="top-notes"
              label="Връхни нотки"
              placeholder="Изберете нотка…"
              items={notes}
              selectedIds={topNoteIds}
              onChange={setTopNoteIds}
            />
            <SelectionField
              id="heart-notes"
              label="Сърдечни нотки"
              placeholder="Изберете нотка…"
              items={notes}
              selectedIds={heartNoteIds}
              onChange={setHeartNoteIds}
            />
            <SelectionField
              id="base-notes"
              label="Базови нотки"
              placeholder="Изберете нотка…"
              items={notes}
              selectedIds={baseNoteIds}
              onChange={setBaseNoteIds}
            />
          </div>

          <div className="max-w-xl">
            <SelectionField
              id="main-accords"
              label="Основни акорди"
              placeholder="Изберете акорд…"
              items={accords}
              selectedIds={accordIds}
              onChange={setAccordIds}
            />
            {!accords.length && (
              <p className="text-ui-fg-subtle mt-2 text-xs">
                Първо добавете записи в отделната секция „Основни акорди“.
              </p>
            )}
          </div>

          <div>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void saveProfile()}
              className="bg-ui-button-inverted shadow-buttons-inverted h-8 rounded-md px-3 text-sm text-white disabled:opacity-50"
            >
              {isSaving ? "Записване…" : "Запази парфюмния профил"}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export default PerfumeProfileEditor
