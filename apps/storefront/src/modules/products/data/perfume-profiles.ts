export type Season = "winter" | "spring" | "summer" | "autumn"

export type PerfumeProfile = {
  brand: string
  concentration: string
  tagline: string
  seasons: Season[]
  accords: string[]
  notes: {
    top: string[]
    heart: string[]
    base: string[]
  }
  longevity: string
  sillage: string
  gender: "Мъжки" | "Женски" | "Унисекс" | ""
}

type TaxonomyReference = {
  id: string
  kind: "designer" | "note" | "accord"
  name: string
}

const demoProfiles: Record<string, PerfumeProfile> = {
  "demo-perfume-01": {
    brand: "Lattafa",
    concentration: "Парфюмна вода",
    tagline:
      "Топъл плодов аромат с кадифен амбров акорд, мек мускус и сух дървесен финал.",
    seasons: ["winter", "autumn"],
    accords: ["Плодов", "Сладък", "Бели цветя", "Цитрусов", "Амбров", "Мускусен"],
    notes: {
      top: ["Ананас", "Бергамот", "Ябълка"],
      heart: ["Жасмин", "Бреза", "Амбров акорд"],
      base: ["Дъбов мъх", "Мускус", "Сандалово дърво"],
    },
    longevity: "Дълготрайна",
    sillage: "Силна",
    gender: "Мъжки",
  },
}

const readIds = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []

const readText = (value: unknown) =>
  typeof value === "string" ? value : ""

const normalizeConcentration = (value: string) => {
  const translations: Record<string, string> = {
    "Parfum / Extrait de Parfum": "Парфюмен екстракт",
    "Eau de Parfum": "Парфюмна вода",
    "Eau de Toilette": "Тоалетна вода",
    "Eau de Cologne": "Одеколон",
  }
  return translations[value] || value
}

const readSeasons = (value: unknown): Season[] =>
  readIds(value).filter(
    (season): season is Season =>
      season === "winter" ||
      season === "spring" ||
      season === "summer" ||
      season === "autumn"
  )

const readGender = (value: unknown): PerfumeProfile["gender"] =>
  value === "Мъжки" || value === "Женски" || value === "Унисекс"
    ? value
    : ""

export const getPerfumeProfile = (
  handle?: string | null,
  metadata?: Record<string, unknown> | null,
  taxonomyItems: TaxonomyReference[] = []
) => {
  const fallback = handle ? demoProfiles[handle] : undefined
  const storedValue = metadata?.perfume_profile

  if (
    !storedValue ||
    typeof storedValue !== "object" ||
    Array.isArray(storedValue)
  ) {
    return fallback
  }

  const stored = storedValue as Record<string, unknown>
  const designerId =
    typeof stored.designer_id === "string" ? stored.designer_id : ""
  const designer = taxonomyItems.find(
    (item) => item.kind === "designer" && item.id === designerId
  )
  const noteName = (id: string) =>
    taxonomyItems.find((item) => item.kind === "note" && item.id === id)?.name
  const toNoteNames = (value: unknown) =>
    readIds(value)
      .map(noteName)
      .filter((name): name is string => Boolean(name))
  const notes = {
    top: toNoteNames(stored.top_note_ids),
    heart: toNoteNames(stored.heart_note_ids),
    base: toNoteNames(stored.base_note_ids),
  }
  const accordIds = readIds(stored.accord_ids)
  const storedAccords = accordIds
    .map(
      (id) =>
        taxonomyItems.find(
          (item) => item.kind === "accord" && item.id === id
        )?.name
    )
    .filter((name): name is string => Boolean(name))
  const hasStoredAccords = Object.prototype.hasOwnProperty.call(
    stored,
    "accord_ids"
  )
  const hasStoredSeasons = Object.prototype.hasOwnProperty.call(
    stored,
    "seasons"
  )
  const concentration = normalizeConcentration(readText(stored.concentration))
  const tagline = readText(stored.tagline)
  const longevity = readText(stored.longevity)
  const sillage = readText(stored.sillage)
  const gender = readGender(stored.gender)
  const hasStoredData =
    Boolean(designer) ||
    notes.top.length > 0 ||
    notes.heart.length > 0 ||
    notes.base.length > 0 ||
    storedAccords.length > 0 ||
    Boolean(concentration || tagline || longevity || sillage || gender) ||
    readSeasons(stored.seasons).length > 0

  if (!hasStoredData) {
    return fallback
  }

  return {
    brand:
      designer?.name ||
      fallback?.brand ||
      (typeof metadata?.brand === "string" ? metadata.brand : "Parfumerie"),
    concentration: concentration || fallback?.concentration || "",
    tagline: tagline || fallback?.tagline || "",
    seasons: hasStoredSeasons
      ? readSeasons(stored.seasons)
      : fallback?.seasons || [],
    accords: hasStoredAccords ? storedAccords : fallback?.accords || [],
    notes,
    longevity: longevity || fallback?.longevity || "",
    sillage: sillage || fallback?.sillage || "",
    gender: gender || fallback?.gender || "",
  } satisfies PerfumeProfile
}
