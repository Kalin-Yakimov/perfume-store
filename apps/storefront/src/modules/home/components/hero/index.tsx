import LocalizedClientLink from "@modules/common/components/localized-client-link"

const Hero = () => {
  return (
    <section className="relative overflow-hidden border-b border-[#d9d0c4] bg-[#f0ebe4] text-[#211d19]">
      <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-[#d8c4ac]/45 blur-3xl" />
      <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-[#cab2a0]/35 blur-3xl" />

      <div className="content-container relative grid min-h-[680px] items-center gap-16 py-20 small:grid-cols-[1.05fr_0.95fr] small:py-28">
        <div className="relative z-10 max-w-2xl">
          <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#786858]">
            Подбрани аромати с характер
          </p>
          <h1 className="font-display text-[52px] font-normal leading-[0.98] tracking-[-0.04em] xsmall:text-[68px] small:text-[82px]">
            Открийте аромат,
            <span className="block italic text-[#7d5f49]">който остава.</span>
          </h1>
          <p className="mt-8 max-w-lg text-base leading-7 text-[#62574d] small:text-lg">
            Селекция от класически, нишови и съвременни парфюми, подбрани
            според настроение, характер и повод.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <LocalizedClientLink
              href="/parfyumi"
              className="inline-flex min-h-12 items-center justify-center bg-[#211d19] px-7 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-[#59493d]"
            >
              Разгледай ароматите
            </LocalizedClientLink>
            <LocalizedClientLink
              href="/#fragrance-finder"
              className="inline-flex min-h-12 items-center justify-center border border-[#7d6d5e] px-7 text-xs font-semibold uppercase tracking-[0.18em] transition-colors hover:bg-white/60"
            >
              Помогни ми да избера
            </LocalizedClientLink>
          </div>
        </div>

        <div className="relative hidden min-h-[520px] items-center justify-center small:flex" aria-hidden="true">
          <div className="absolute h-[420px] w-[420px] rounded-full border border-[#bcae9f]/70" />
          <div className="absolute h-[330px] w-[330px] rounded-full bg-[#e7ded3] shadow-[0_40px_100px_rgba(66,46,30,0.14)]" />
          <div className="absolute bottom-10 h-10 w-72 rounded-[50%] bg-[#594535]/20 blur-xl" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="h-14 w-24 rounded-t-md border border-[#796553]/40 bg-gradient-to-b from-[#4c4037] to-[#1f1a17] shadow-lg" />
            <div className="-mt-1 h-5 w-32 rounded-sm border border-[#aa927e]/60 bg-[#c8ad96]" />
            <div className="relative h-72 w-52 overflow-hidden rounded-[2.25rem_2.25rem_1rem_1rem] border border-white/70 bg-gradient-to-br from-[#f6e3cb]/80 via-[#c99d76]/75 to-[#8b6248]/85 shadow-[0_35px_70px_rgba(65,43,27,0.28)] backdrop-blur-sm">
              <div className="absolute left-5 top-4 h-44 w-10 rotate-6 rounded-full bg-white/30 blur-md" />
              <div className="absolute inset-x-5 bottom-16 border-y border-[#5c4939]/35 bg-[#f4ede3]/75 py-6 text-center">
                <p className="font-display text-xl tracking-[0.18em]">PARFUMERIE</p>
                <p className="mt-1 text-[8px] uppercase tracking-[0.32em]">Парфюмна вода</p>
              </div>
            </div>
          </div>

          <div className="absolute left-0 top-20 border border-[#c7b9aa] bg-[#f8f4ef]/90 px-5 py-4 shadow-sm">
            <p className="text-[9px] uppercase tracking-[0.25em] text-[#867465]">Връхни нотки</p>
            <p className="mt-1 font-display text-lg">Бергамот · Ирис</p>
          </div>
          <div className="absolute bottom-24 right-0 border border-[#c7b9aa] bg-[#f8f4ef]/90 px-5 py-4 shadow-sm">
            <p className="text-[9px] uppercase tracking-[0.25em] text-[#867465]">Базови нотки</p>
            <p className="mt-1 font-display text-lg">
              Амбров акорд · Сандалово дърво
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero
