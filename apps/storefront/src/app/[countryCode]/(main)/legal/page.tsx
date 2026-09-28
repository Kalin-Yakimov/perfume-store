import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Правна информация",
  description: "Общи условия, поверителност и информация за бисквитките.",
}

export default function LegalPage() {
  return (
    <div className="bg-[#fbf9f6]">
      <section className="border-b border-[#ded7cf] bg-[#eee8df] py-7 small:py-8">
        <div className="content-container max-w-4xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#826c5a]">
            Информация за клиента
          </p>
          <h1 className="font-display mt-1 text-3xl tracking-[-0.02em] small:text-4xl">
            Правна информация
          </h1>
        </div>
      </section>

      <section className="content-container max-w-4xl py-12 small:py-16">
        <p className="max-w-2xl text-sm leading-7 text-[#695e54]">
          Правните документи все още не са публикувани. Те трябва да съдържат
          данните на търговеца и точните условия на магазина и да бъдат
          проверени преди приемане на реални поръчки.
        </p>

        <div className="mt-10 space-y-10">
          <section className="border-t border-[#ded7cf] pt-8">
            <h2 className="font-display text-3xl">Общи условия</h2>
            <p className="mt-4 text-sm leading-7 text-[#6c6259]">
              Предстои публикуване на данните за търговеца, поръчките, цените,
              плащането, доставката, отказа и рекламациите.
            </p>
          </section>
          <section className="border-t border-[#ded7cf] pt-8">
            <h2 className="font-display text-3xl">Поверителност</h2>
            <p className="mt-4 text-sm leading-7 text-[#6c6259]">
              Предстои описание на обработваните лични данни, целите и сроковете
              за съхранение, както и начините за упражняване на правата на
              клиентите.
            </p>
          </section>
          <section className="border-t border-[#ded7cf] pt-8">
            <h2 className="font-display text-3xl">Бисквитки</h2>
            <p className="mt-4 text-sm leading-7 text-[#6c6259]">
              Предстои информация за използваните бисквитки и настройките за
              съгласие.
            </p>
          </section>
        </div>
      </section>
    </div>
  )
}
