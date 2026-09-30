import { Metadata } from "next"
import Image from "next/image"

import { listPerfumeTaxonomies } from "@lib/data/perfume-taxonomies"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export const metadata: Metadata = {
  title: "Дизайнери",
  description: "Открийте парфюми от утвърдени и нишови парфюмни къщи.",
}

export default async function DesignersPage() {
  const designers = await listPerfumeTaxonomies("designer")

  return (
    <div className="bg-[#fbf9f6]">
      <section className="border-b border-[#ded7cf] bg-[#eee8df] py-7 small:py-8">
        <div className="content-container">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#826c5a]">
            Парфюмни къщи
          </p>
          <h1 className="font-display mt-1 text-3xl tracking-[-0.02em] small:text-4xl">
            Дизайнери
          </h1>
        </div>
      </section>

      <section className="content-container py-10 small:py-14">
        <p className="mb-8 max-w-2xl text-sm leading-7 text-[#695e54]">
          Разгледайте селекцията по марка — от вечните класики до съвременната
          нишова парфюмерия.
        </p>
        <div className="grid border-l border-t border-[#ded7cf] xsmall:grid-cols-2 small:grid-cols-3 medium:grid-cols-4">
          {designers.map((designer, index) => (
            <LocalizedClientLink
              key={designer.slug}
              href={`/dizaynerski-kashti/${designer.slug}`}
              className="group grid min-h-36 grid-cols-[88px_1fr] items-center gap-5 border-b border-r border-[#ded7cf] bg-[#fffdf9] p-5 transition hover:bg-[#eee8df]"
            >
              <span className="relative flex h-20 w-[88px] items-center justify-center overflow-hidden bg-white">
                {designer.image_url ? (
                  <Image
                    src={designer.image_url}
                    alt={`Лого на ${designer.name}`}
                    fill
                    sizes="88px"
                    unoptimized
                    className="object-contain p-1"
                  />
                ) : (
                  <span className="font-display text-3xl text-[#b7a89b]">
                    {designer.name.charAt(0)}
                  </span>
                )}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[9px] tracking-[0.2em] text-[#9b8b7d]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="font-display mt-2 text-2xl leading-tight">
                  {designer.name}
                </span>
                <span className="mt-3 text-sm text-[#8b796b] transition-transform group-hover:translate-x-1">
                  Разгледай →
                </span>
              </span>
            </LocalizedClientLink>
          ))}
        </div>
      </section>
    </div>
  )
}
