import { Heading, Text } from "@modules/common/components/ui"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

const EmptyCartMessage = () => {
  return (
    <section
      className="grid w-full max-w-3xl items-center gap-6 border-y border-[#ded7cf] py-8 small:grid-cols-[88px_minmax(0,1fr)] small:gap-10 small:py-12"
      data-testid="empty-cart-message"
    >
      <div
        className="flex h-[88px] w-[88px] items-center justify-center bg-[#eee8df] text-[#806e60]"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 48 48"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-11 w-11"
        >
          <path d="M10 17h28l-2.5 23h-23L10 17Z" />
          <path d="M17 19v-6a7 7 0 0 1 14 0v6" />
        </svg>
      </div>
      <div>
        <Heading
          level="h2"
          className="font-display text-3xl font-normal leading-tight text-[#211d19]"
        >
          Кошницата е празна
        </Heading>
        <Text className="mt-3 max-w-lg text-sm leading-7 text-[#71665c]">
          Изберете аромат от колекцията ни и го добавете в кошницата, за да
          продължите с поръчката.
        </Text>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
          <LocalizedClientLink
            href="/parfyumi"
            className="inline-flex min-h-11 items-center justify-center bg-[#211d19] px-5 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#40372f]"
          >
            Разгледайте парфюмите
          </LocalizedClientLink>
          <LocalizedClientLink
            href="/otlivki"
            className="text-sm font-medium text-[#51483f] underline decoration-[#bda894] underline-offset-4 hover:text-[#211d19]"
          >
            Вижте отливките →
          </LocalizedClientLink>
        </div>
      </div>
    </section>
  )
}

export default EmptyCartMessage
