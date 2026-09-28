export type PerfumeDesigner = {
  name: string
  slug: string
}

export type PerfumeNote = {
  name: string
  slug: string
}

export const perfumeDesigners: PerfumeDesigner[] = [
  { name: "Lattafa", slug: "lattafa" },
  { name: "Armaf", slug: "armaf" },
]

export const perfumeNotes: PerfumeNote[] = [
  { name: "Ананас", slug: "ananas" },
  { name: "Бергамот", slug: "bergamot" },
  { name: "Ябълка", slug: "yabalka" },
  { name: "Жасмин", slug: "zhasmin" },
  { name: "Бреза", slug: "breza" },
  { name: "Амбров акорд", slug: "ambrov-akord" },
  { name: "Дъбов мъх", slug: "dabov-mah" },
  { name: "Мускус", slug: "muskus" },
  { name: "Сандалово дърво", slug: "sandalovo-darvo" },
]

export const getDesignerBySlug = (slug: string) =>
  perfumeDesigners.find((designer) => designer.slug === slug)

export const getDesignerByName = (name: string) =>
  perfumeDesigners.find(
    (designer) => designer.name.toLocaleLowerCase() === name.toLocaleLowerCase()
  )

export const getPerfumeNoteBySlug = (slug: string) =>
  perfumeNotes.find((note) => note.slug === slug)

export const getPerfumeNoteByName = (name: string) =>
  perfumeNotes.find(
    (note) => note.name.toLocaleLowerCase() === name.toLocaleLowerCase()
  )
