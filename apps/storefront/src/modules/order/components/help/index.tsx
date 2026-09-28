import LocalizedClientLink from "@modules/common/components/localized-client-link"

const Help = () => {
  return (
    <div className="mt-8 border border-[#e5d9cd] bg-[#fbf9f6] px-5 py-5 small:px-6">
      <h2 className="font-serif text-xl text-[#25201c]">Имате въпроси?</h2>
      <p className="mt-2 text-sm text-[#65594e]">
        Разгледайте информацията за доставка и връщане или се свържете с нас.
      </p>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-[#25201c]">
        <LocalizedClientLink
          href="/help#delivery"
          className="underline underline-offset-4 hover:no-underline"
        >
          Доставка
        </LocalizedClientLink>
        <LocalizedClientLink
          href="/help#returns"
          className="underline underline-offset-4 hover:no-underline"
        >
          Връщане и рекламации
        </LocalizedClientLink>
        <LocalizedClientLink
          href="/help#contact"
          className="underline underline-offset-4 hover:no-underline"
        >
          Контакт
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default Help
