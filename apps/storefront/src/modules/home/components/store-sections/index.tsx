import LocalizedClientLink from "@modules/common/components/localized-client-link"

const categories = [
  {
    title: "За нея",
    description: "Флорални, плодови и ориенталски композиции",
    accent: "bg-[#ead8d1]",
    number: "01",
  },
  {
    title: "За него",
    description: "Дървесни, свежи и ароматични профили",
    accent: "bg-[#d8ddd7]",
    number: "02",
  },
  {
    title: "Унисекс",
    description: "Аромати отвъд правилата и определенията",
    accent: "bg-[#e2d9c6]",
    number: "03",
  },
  {
    title: "Нишова селекция",
    description: "Редки съставки и отличим почерк",
    accent: "bg-[#d9d2cd]",
    number: "04",
  },
]

const serviceHighlights = [
  ["Проверен произход", "Само продукти от проверени доставчици"],
  ["Безплатна доставка", "За поръчки над 150 €"],
  ["Лична консултация", "Помагаме ви да откриете точния аромат"],
]

const notes = [
  { label: "Свежи", note: "Цитрус · Морски нотки", color: "bg-[#dce3dc]" },
  { label: "Флорални", note: "Роза · Ирис · Жасмин", color: "bg-[#ead7d8]" },
  { label: "Дървесни", note: "Кедър · Ветивер · Уд", color: "bg-[#d8cec2]" },
  {
    label: "Ориенталски",
    note: "Амбров акорд · Ванилия · Подправки",
    color: "bg-[#dfcfbd]",
  },
]

export default function StoreSections() {
  return (
    <>
      <section className="border-b border-[#ded7cf] bg-[#fbf9f6]">
        <div className="content-container grid divide-y divide-[#ded7cf] small:grid-cols-3 small:divide-x small:divide-y-0">
          {serviceHighlights.map(([title, description]) => (
            <div key={title} className="px-0 py-8 small:px-8 small:first:pl-0 small:last:pr-0">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#302923]">
                {title}
              </h2>
              <p className="mt-2 text-sm text-[#776b61]">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#fbf9f6] py-20 small:py-28">
        <div className="content-container">
          <div className="mb-12 flex flex-col justify-between gap-5 small:flex-row small:items-end">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#826c5a]">
                Започнете оттук
              </p>
              <h2 className="font-display mt-3 text-4xl tracking-[-0.02em] small:text-5xl">
                Аромат за всеки характер
              </h2>
            </div>
            <LocalizedClientLink
              href="/parfyumi"
              className="w-fit border-b border-[#302923] pb-1 text-xs font-semibold uppercase tracking-[0.16em]"
            >
              Виж целия каталог
            </LocalizedClientLink>
          </div>

          <div className="grid gap-4 xsmall:grid-cols-2 small:grid-cols-4">
            {categories.map((category) => (
              <LocalizedClientLink
                key={category.title}
                href="/parfyumi"
                className={`${category.accent} group relative flex min-h-80 flex-col justify-between overflow-hidden p-7 transition-transform duration-300 hover:-translate-y-1`}
              >
                <span className="text-[10px] font-semibold tracking-[0.22em] text-[#766659]">
                  {category.number}
                </span>
                <div className="absolute -right-12 top-12 h-44 w-44 rounded-full border border-white/60 transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute -right-2 top-24 h-28 w-28 rounded-full bg-white/25" />
                <div className="relative z-10">
                  <h3 className="font-display text-3xl">{category.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#685e55]">
                    {category.description}
                  </p>
                  <span className="mt-6 inline-block text-lg transition-transform duration-300 group-hover:translate-x-2">
                    →
                  </span>
                </div>
              </LocalizedClientLink>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#ded7cf] bg-[#eee8df] py-20 small:py-28">
        <div className="content-container grid items-center gap-14 small:grid-cols-2">
          <div className="grid grid-cols-2 gap-3">
            {notes.map((item) => (
              <div key={item.label} className={`${item.color} flex aspect-square flex-col justify-end p-6`}>
                <span className="font-display text-2xl">{item.label}</span>
                <span className="mt-2 text-xs leading-5 text-[#74685e]">{item.note}</span>
              </div>
            ))}
          </div>

          <div id="fragrance-finder" className="max-w-xl scroll-mt-36 small:pl-10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#826c5a]">
              Ароматен профил
            </p>
            <h2 className="font-display mt-4 text-4xl leading-tight tracking-[-0.02em] small:text-6xl">
              Не знаете откъде да започнете?
            </h2>
            <p className="mt-6 text-base leading-7 text-[#695e54]">
              Изберете любимите си нотки, сезон и настроение. По-късно тук ще
              добавим кратък въпросник, който ще ви насочва към подходящи
              аромати от каталога.
            </p>
            <LocalizedClientLink
              href="/parfyumi"
              className="mt-8 inline-flex min-h-12 items-center bg-[#211d19] px-7 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-[#59493d]"
            >
              Разгледай по ароматни групи
            </LocalizedClientLink>
          </div>
        </div>
      </section>

      <section className="bg-[#28231f] py-20 text-[#f5efe8] small:py-24">
        <div className="content-container flex flex-col items-center text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#c8ae97]">
            Останете във връзка
          </p>
          <h2 className="font-display mt-4 max-w-2xl text-4xl leading-tight small:text-5xl">
            Нови аромати и лични препоръки
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-6 text-[#c8beb5]">
            Формата ще бъде свързана с имейл услугата, когато изберем доставчик.
          </p>
          <div className="mt-9 flex w-full max-w-xl border-b border-[#8f8073]">
            <input
              type="email"
              aria-label="Имейл адрес"
              placeholder="Вашият имейл адрес"
              className="min-w-0 flex-1 bg-transparent py-4 text-sm text-white outline-none placeholder:text-[#92867d]"
            />
            <button type="button" className="px-3 text-xs font-semibold uppercase tracking-[0.16em]">
              Абонирай ме
            </button>
          </div>
        </div>
      </section>
    </>
  )
}
