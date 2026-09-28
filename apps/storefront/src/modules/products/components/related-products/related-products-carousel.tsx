"use client"

import {
  Children,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

type RelatedProductsCarouselProps = {
  children: ReactNode
  hasSimilarProducts: boolean
}

export default function RelatedProductsCarousel({
  children,
  hasSimilarProducts,
}: RelatedProductsCarouselProps) {
  const scrollerRef = useRef<HTMLUListElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateControls = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    setCanScrollLeft(scroller.scrollLeft > 2)
    setCanScrollRight(
      scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2,
    )
  }, [])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    updateControls()
    const observer = new ResizeObserver(updateControls)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [updateControls])

  const moveOneCard = (direction: -1 | 1) => {
    const scroller = scrollerRef.current
    const card = scroller?.firstElementChild
    if (!scroller || !card) return

    const gap =
      Number.parseFloat(window.getComputedStyle(scroller).columnGap) || 0
    scroller.scrollBy({
      left: direction * (card.getBoundingClientRect().width + gap),
      behavior: "smooth",
    })
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#806e60]">
            Открийте още
          </p>
          <h2 className="font-display mt-1 text-2xl leading-tight text-[#211d19] small:text-3xl">
            Може да ви харесат
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#71665c]">
            {hasSimilarProducts
              ? "Подбрани по сходни нотки и ароматен характер."
              : "Още аромати от нашата селекция."}
          </p>
        </div>
        <div
          className="flex shrink-0 gap-2"
          role="group"
          aria-label="Навигация между препоръчаните парфюми"
        >
          <button
            type="button"
            onClick={() => moveOneCard(-1)}
            disabled={!canScrollLeft}
            aria-label="Предишен парфюм"
            className="flex h-10 w-10 items-center justify-center border border-[#cfc3b6] text-[#211d19] transition hover:bg-[#eee8df] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#806e60] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            onClick={() => moveOneCard(1)}
            disabled={!canScrollRight}
            aria-label="Следващ парфюм"
            className="flex h-10 w-10 items-center justify-center border border-[#cfc3b6] text-[#211d19] transition hover:bg-[#eee8df] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#806e60] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <ul
        ref={scrollerRef}
        onScroll={updateControls}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth"
        data-testid="related-products-list"
      >
        {Children.map(children, (child) => (
          <li className="w-[78%] shrink-0 snap-start border border-[#ded7cf] bg-[#fffdf9] p-3 transition-colors hover:border-[#bba999] xsmall:w-[calc((100%-16px)/2)] small:w-[calc((100%-64px)/5)]">
            {child}
          </li>
        ))}
      </ul>
    </div>
  )
}
