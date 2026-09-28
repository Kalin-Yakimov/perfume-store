import LocalizedClientLink from "@modules/common/components/localized-client-link"

const informationLinks = [
  ["Доставка и плащане", "/help#delivery"],
  ["Връщане и рекламации", "/help#returns"],
  ["Контакт", "/help#contact"],
  ["Правна информация", "/legal"],
]

export default function Footer() {
  return (
    <footer className="border-t border-[#3d3732] bg-[#211d19] text-[#eee7df]">
      <div className="content-container pt-5 small:pt-6">
        <div className="grid gap-5 small:grid-cols-[minmax(220px,0.75fr)_1.25fr] small:items-center">
          <div className="max-w-sm">
            <LocalizedClientLink href="/" className="font-display text-2xl tracking-[0.18em]">
              PARFUMERIE
            </LocalizedClientLink>
            <p className="mt-1 text-xs leading-5 text-[#a99e94]">
              Подбрани аромати и парфюмни отливки.
            </p>
          </div>

          <nav aria-label="Информация">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#bda894]">
              Информация
            </h2>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#c7bdb4]">
              {informationLinks.map(([label, href]) => (
                <li key={label}>
                  <LocalizedClientLink href={href} className="hover:text-white">
                    {label}
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div aria-hidden="true" className="mt-5 border-t border-[#3d3732]" />
      </div>
    </footer>
  )
}
