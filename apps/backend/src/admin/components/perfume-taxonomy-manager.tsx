import { toast } from "@medusajs/ui"
import { FormEvent, useCallback, useEffect, useState } from "react"

export type TaxonomyKind = "designer" | "note" | "accord"

export type TaxonomyItem = {
  id: string
  kind: TaxonomyKind
  name: string
  original_name: string | null
  slug: string
  image_url: string | null
}

type TaxonomyManagerProps = {
  kind: TaxonomyKind
  title: string
  description: string
}

export const adminRequest = async <T,>(
  url: string,
  options?: RequestInit
): Promise<T> => {
  const response = await fetch(url, {
    credentials: "include",
    ...options,
  })

  if (!response.ok) {
    const result = await response.json().catch(() => null)
    throw new Error(result?.message || "Заявката не беше успешна.")
  }

  return response.json()
}

const uploadImage = async (file: File) => {
  const formData = new FormData()
  formData.append("files", file)

  const result = await adminRequest<{ files: { url: string }[] }>(
    "/admin/uploads",
    {
      method: "POST",
      body: formData,
    }
  )

  if (!result.files[0]?.url) {
    throw new Error("Изображението не беше качено.")
  }

  return result.files[0].url
}

const PerfumeTaxonomyManager = ({
  kind,
  title,
  description,
}: TaxonomyManagerProps) => {
  const hasTranslatedName = kind !== "designer"
  const hasImage = kind !== "accord"
  const [items, setItems] = useState<TaxonomyItem[]>([])
  const [name, setName] = useState("")
  const [originalName, setOriginalName] = useState("")
  const [slug, setSlug] = useState("")
  const [newImage, setNewImage] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editOriginalName, setEditOriginalName] = useState("")
  const [editSlug, setEditSlug] = useState("")
  const [editImage, setEditImage] = useState<File | null>(null)
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await adminRequest<{ items: TaxonomyItem[] }>(
        `/admin/perfume-taxonomies?kind=${kind}`
      )
      setItems(result.items)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Грешка при зареждане."
      )
    } finally {
      setIsLoading(false)
    }
  }, [kind])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  useEffect(() => {
    if (!editImage) {
      setEditImagePreview(null)
      return
    }

    const previewUrl = URL.createObjectURL(editImage)
    setEditImagePreview(previewUrl)

    return () => URL.revokeObjectURL(previewUrl)
  }, [editImage])

  const createItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!name.trim()) {
      toast.error("Въведете име.")
      return
    }

    if (hasTranslatedName && !originalName.trim()) {
      toast.error("Въведете и оригиналното английско име.")
      return
    }

    setIsSaving(true)
    try {
      const imageUrl = hasImage && newImage ? await uploadImage(newImage) : null
      await adminRequest("/admin/perfume-taxonomies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name,
          original_name: hasTranslatedName ? originalName : null,
          slug: slug || name,
          image_url: imageUrl,
        }),
      })
      setName("")
      setOriginalName("")
      setSlug("")
      setNewImage(null)
      toast.success("Записът е добавен.")
      await loadItems()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Записът не беше добавен."
      )
    } finally {
      setIsSaving(false)
    }
  }

  const startEditing = (item: TaxonomyItem) => {
    setEditingId(item.id)
    setEditName(item.name)
    setEditOriginalName(item.original_name || "")
    setEditSlug(item.slug)
    setEditImage(null)
  }

  const saveItem = async (item: TaxonomyItem) => {
    if (
      !editName.trim() ||
      !editSlug.trim() ||
      (hasTranslatedName && !editOriginalName.trim())
    ) {
      toast.error(
        hasTranslatedName
          ? "Българското име, английското име и URL адресът са задължителни."
          : "Името и URL адресът са задължителни."
      )
      return
    }

    setSavingId(item.id)
    try {
      const imageUrl = hasImage && editImage
        ? await uploadImage(editImage)
        : undefined
      await adminRequest(`/admin/perfume-taxonomies/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          original_name: hasTranslatedName ? editOriginalName : null,
          slug: editSlug,
          ...(imageUrl ? { image_url: imageUrl } : {}),
        }),
      })
      setEditingId(null)
      setEditImage(null)
      toast.success("Записът е обновен.")
      await loadItems()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Записът не беше обновен."
      )
    } finally {
      setSavingId(null)
    }
  }

  const deleteItem = async (item: TaxonomyItem) => {
    if (!window.confirm(`Да бъде ли изтрит записът „${item.name}“?`)) {
      return
    }

    setSavingId(item.id)
    try {
      await adminRequest(`/admin/perfume-taxonomies/${item.id}`, {
        method: "DELETE",
      })
      toast.success("Записът е изтрит.")
      await loadItems()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Записът не беше изтрит."
      )
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border">
        <div className="border-b px-6 py-4">
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-ui-fg-subtle mt-1 text-sm">{description}</p>
        </div>

        <form
          onSubmit={createItem}
          className="grid gap-4 px-6 py-5 md:grid-cols-2"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor={`${kind}-name`} className="text-sm font-medium">
              {hasTranslatedName ? "Име на български" : "Име"}
            </label>
            <input
              id={`${kind}-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={
                kind === "note"
                  ? "Например Сандалово дърво"
                  : kind === "accord"
                    ? "Например Дървесен"
                    : "Например Lattafa"
              }
              className="bg-ui-bg-field h-8 rounded-md border px-2 text-sm outline-none"
            />
          </div>

          {hasTranslatedName && (
            <div className="flex flex-col gap-2">
              <label htmlFor="note-original-name" className="text-sm font-medium">
                Име на английски
              </label>
              <input
                id="note-original-name"
                value={originalName}
                onChange={(event) => setOriginalName(event.target.value)}
                placeholder={
                  kind === "note" ? "Например Sandalwood" : "Например Woody"
                }
                required
                className="bg-ui-bg-field h-8 rounded-md border px-2 text-sm outline-none"
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor={`${kind}-slug`} className="text-sm font-medium">
              URL име (български на латиница)
            </label>
            <input
              id={`${kind}-slug`}
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder={
                kind === "note"
                  ? "Например sandalovo-darvo"
                  : kind === "accord"
                    ? "Например darvesen"
                    : "Автоматично от името"
              }
              className="bg-ui-bg-field h-8 rounded-md border px-2 text-sm outline-none"
            />
          </div>

          {hasImage && (
            <div className="flex flex-col gap-2">
              <label htmlFor={`${kind}-image`} className="text-sm font-medium">
                {kind === "note" ? "Снимка" : "Лого"}
              </label>
              <input
                id={`${kind}-image`}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="bg-ui-bg-field h-8 rounded-md border px-2 text-sm"
                onChange={(event) =>
                  setNewImage(event.target.files?.[0] || null)
                }
              />
            </div>
          )}

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-ui-button-inverted shadow-buttons-inverted h-8 rounded-md px-3 text-sm text-white disabled:opacity-50"
            >
              {isSaving ? "Добавяне…" : "Добави запис"}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">Всички записи</h2>
          <span className="text-ui-fg-subtle text-sm">{items.length} общо</span>
        </div>

        {isLoading ? (
          <p className="text-ui-fg-subtle text-sm">Зареждане…</p>
        ) : !items.length ? (
          <p className="text-ui-fg-subtle text-sm">
            Все още няма добавени записи.
          </p>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <div key={item.id} className="py-4">
                <div
                  className={`grid items-center gap-4 ${
                    hasImage
                      ? "md:grid-cols-[72px_1fr_auto]"
                      : "md:grid-cols-[1fr_auto]"
                  }`}
                >
                  {hasImage && (
                    <div className="bg-ui-bg-subtle flex size-[72px] items-center justify-center overflow-hidden rounded-md border">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="size-full object-contain"
                        />
                      ) : (
                        <span className="text-ui-fg-muted text-center text-xs">
                          Без снимка
                        </span>
                      )}
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    {item.original_name && (
                      <p className="text-ui-fg-subtle text-xs">
                        {item.original_name}
                      </p>
                    )}
                    <p className="text-ui-fg-muted text-xs">/{item.slug}</p>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className="shadow-buttons-neutral h-8 rounded-md border px-3 text-sm"
                      onClick={() => startEditing(item)}
                    >
                      Редактирай
                    </button>
                    <button
                      type="button"
                      disabled={savingId === item.id}
                      className="bg-ui-bg-base shadow-buttons-neutral h-8 rounded-md border px-3 text-sm text-red-600 disabled:opacity-50"
                      onClick={() => void deleteItem(item)}
                    >
                      Изтрий
                    </button>
                  </div>
                </div>

                {editingId === item.id && (
                  <div
                    className={`bg-ui-bg-subtle mt-4 grid gap-4 rounded-md border p-4 ${
                      hasImage ? "md:grid-cols-[112px_1fr]" : "md:grid-cols-1"
                    }`}
                  >
                    {hasImage && (
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">Преглед</span>
                        <div className="bg-ui-bg-base flex size-28 items-center justify-center overflow-hidden rounded-md border">
                          {editImagePreview || item.image_url ? (
                            <img
                              src={editImagePreview || item.image_url || ""}
                              alt={`Преглед на ${editName}`}
                              className="size-full object-contain"
                            />
                          ) : (
                            <span className="text-ui-fg-muted text-center text-xs">
                              Без снимка
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="flex flex-col gap-2">
                        <label
                          htmlFor={`edit-name-${item.id}`}
                          className="text-sm font-medium"
                        >
                          {hasTranslatedName ? "Име на български" : "Име"}
                        </label>
                        <input
                          id={`edit-name-${item.id}`}
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          className="bg-ui-bg-field h-8 rounded-md border px-2 text-sm outline-none"
                        />
                      </div>

                      {hasTranslatedName && (
                        <div className="flex flex-col gap-2">
                          <label
                            htmlFor={`edit-original-name-${item.id}`}
                            className="text-sm font-medium"
                          >
                            Име на английски
                          </label>
                          <input
                            id={`edit-original-name-${item.id}`}
                            value={editOriginalName}
                            onChange={(event) =>
                              setEditOriginalName(event.target.value)
                            }
                            className="bg-ui-bg-field h-8 rounded-md border px-2 text-sm outline-none"
                          />
                        </div>
                      )}

                      <div className="flex flex-col gap-2">
                        <label
                          htmlFor={`edit-slug-${item.id}`}
                          className="text-sm font-medium"
                        >
                          URL адрес (български на латиница)
                        </label>
                        <div className="flex items-center">
                          <span className="text-ui-fg-muted pr-1 text-sm">/</span>
                          <input
                            id={`edit-slug-${item.id}`}
                            value={editSlug}
                            onChange={(event) => setEditSlug(event.target.value)}
                            className="bg-ui-bg-field h-8 min-w-0 flex-1 rounded-md border px-2 text-sm outline-none"
                          />
                        </div>
                      </div>

                      {hasImage && (
                        <div className="flex flex-col gap-2 md:col-span-3">
                          <label
                            htmlFor={`edit-image-${item.id}`}
                            className="text-sm font-medium"
                          >
                            {kind === "note"
                              ? "Смени снимката"
                              : "Смени логото"}
                          </label>
                          <input
                            id={`edit-image-${item.id}`}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            className="bg-ui-bg-field h-8 rounded-md border px-2 text-sm"
                            onChange={(event) =>
                              setEditImage(event.target.files?.[0] || null)
                            }
                          />
                          <p className="text-ui-fg-subtle text-xs">
                            Ако не изберете нов файл, сегашното изображение ще
                            се запази.
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2 md:col-span-3">
                        <button
                          type="button"
                          disabled={savingId === item.id}
                          className="bg-ui-button-inverted h-8 rounded-md px-3 text-sm text-white disabled:opacity-50"
                          onClick={() => void saveItem(item)}
                        >
                          Запази
                        </button>
                        <button
                          type="button"
                          className="shadow-buttons-neutral h-8 rounded-md border px-3 text-sm"
                          onClick={() => {
                            setEditingId(null)
                            setEditImage(null)
                          }}
                        >
                          Отказ
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default PerfumeTaxonomyManager
