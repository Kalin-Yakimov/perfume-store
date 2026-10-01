import { Metadata } from "next"
import Image from "next/image"

import { listPerfumeTaxonomies } from "@lib/data/perfume-taxonomies"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export const metadata: Metadata = {
  title: "Парфюмни нотки",
  description: "Изберете аромат според любимите си парфюмни нотки.",
  alternates: { canonical: "/parfyumni-notki" },
}

export default async function PerfumeNotesPage() {
  const notes = await listPerfumeTaxonomies("note")

  return (
    <div className="bg-[#fbf9f6]">
      <section className="border-b border-[#ded7cf] bg-[#eee8df] py-7 small:py-8">
        <div className="content-container">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#826c5a]">
            Изберете по усещане
          </p>
          <h1 className="font-display mt-1 text-3xl tracking-[-0.02em] small:text-4xl">
            Парфюмни нотки
          </h1>
        </div>
      </section>

      <section className="content-container py-10 small:py-14">
        <p className="mb-8 max-w-2xl text-sm leading-7 text-[#695e54]">
          Ако още не знаете точния парфюм, започнете от ароматите, които
          обичате.
        </p>
        <div className="grid border-l border-t border-[#ded7cf] xsmall:grid-cols-2 small:grid-cols-3 medium:grid-cols-4">
          {notes.map((note) => (
            <LocalizedClientLink
              key={note.slug}
              href={`/parfyumni-notki/${note.slug}`}
              className="group flex min-h-28 items-center gap-4 border-b border-r border-[#ded7cf] bg-[#fffdf9] p-4 transition hover:bg-[#eee8df]"
            >
              <span className="relative h-20 w-20 shrink-0 overflow-hidden bg-[#f1ece6]">
                {note.image_url ? (
                  <Image
                    src={note.image_url}
                    alt={note.name}
                    fill
                    sizes="80px"
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <span className="font-display text-2xl text-[#b7a89b]">
                    {note.name.charAt(0)}
                  </span>
                )}
              </span>
              <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <h2 className="font-display text-xl">{note.name}</h2>
                <span className="text-sm text-[#8b796b] transition-transform group-hover:translate-x-1">
                  →
                </span>
              </span>
            </LocalizedClientLink>
          ))}
        </div>
      </section>
    </div>
  )
}
