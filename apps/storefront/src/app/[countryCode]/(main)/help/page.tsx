import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Помощ",
  description: "Информация за доставка, плащане, връщане и контакт.",
  robots: { index: false, follow: false },
}

const helpSections = [
  {
    id: "delivery",
    number: "01",
    title: "Доставка и плащане",
    text: "Информацията за сроковете, цените и методите за доставка и плащане предстои да бъде публикувана.",
  },
  {
    id: "returns",
    number: "02",
    title: "Връщане и рекламации",
    text: "Условията за отказ от поръчка, връщане и рекламации ще бъдат публикувани преди магазинът да започне да приема реални поръчки.",
  },
  {
    id: "orders",
    number: "03",
    title: "Поръчки",
    text: "Може да поръчате и без регистрация. С профил ще имате достъп до историята на поръчките си.",
  },
  {
    id: "contact",
    number: "04",
    title: "Контакт",
    text: "Телефонът, имейлът и адресът за връщане ще бъдат посочени тук, след като бъдат потвърдени.",
  },
]

export default function HelpPage() {
  return (
    <div className="bg-[#fbf9f6]">
      <section className="border-b border-[#ded7cf] bg-[#eee8df] py-7 small:py-8">
        <div className="content-container max-w-5xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#826c5a]">
            Обслужване
          </p>
          <h1 className="font-display mt-1 text-3xl tracking-[-0.02em] small:text-4xl">
            Как можем да помогнем?
          </h1>
        </div>
      </section>

      <section className="content-container max-w-5xl py-16 small:py-24">
        <p className="mb-8 max-w-2xl text-sm leading-7 text-[#695e54]">
          Събрахме най-важната информация на едно място, без отделна страница за
          всеки въпрос.
        </p>
        <div className="divide-y divide-[#ded7cf] border-y border-[#ded7cf]">
          {helpSections.map((section) => (
            <article
              key={section.id}
              id={section.id}
              className="grid scroll-mt-36 gap-5 py-10 small:grid-cols-[80px_260px_1fr]"
            >
              <span className="text-xs tracking-[0.2em] text-[#9a8878]">
                {section.number}
              </span>
              <h2 className="font-display text-2xl">{section.title}</h2>
              <p className="max-w-xl text-sm leading-7 text-[#6c6259]">
                {section.text}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
