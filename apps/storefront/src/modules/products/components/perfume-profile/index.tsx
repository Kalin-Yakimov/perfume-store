import {
  PerfumeProfile,
  Season,
} from "@modules/products/data/perfume-profiles"
import { PerfumeTaxonomyItem } from "@lib/data/perfume-taxonomies"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Fragment, ReactNode } from "react"

const seasonLabels: Record<Season, string> = {
  winter: "Зима",
  spring: "Пролет",
  summer: "Лято",
  autumn: "Есен",
}

const SeasonIcon = ({ season }: { season: Season }) => {
  const iconClasses = "h-6 w-6"

  if (season === "winter") {
    return (
      <svg
        className={iconClasses}
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <path d="M24 5v38M8 14l32 20M40 14 8 34M18 8l6 6 6-6M18 40l6-6 6 6M8 22l8 2-2 8M40 22l-8 2 2 8" />
      </svg>
    )
  }

  if (season === "spring") {
    return (
      <svg
        className={iconClasses}
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <path d="M38 8C22 9 12 17 11 34c15 1 25-8 27-26Z" />
        <path d="M11 40c5-12 13-20 25-29" />
      </svg>
    )
  }

  if (season === "summer") {
    return (
      <svg
        className={iconClasses}
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <circle cx="24" cy="24" r="8" />
        <path d="M24 4v7M24 37v7M4 24h7M37 24h7M10 10l5 5M33 33l5 5M38 10l-5 5M15 33l-5 5" />
      </svg>
    )
  }

  return (
    <svg
      className={iconClasses}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M39 9C24 9 12 18 11 35c16 1 27-9 28-26Z" />
      <path d="M12 39c7-11 14-18 25-27M21 26l-1-8M28 20l7 1M17 32l-1-6" />
    </svg>
  )
}

const TextDetail = ({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) => (
  <div className="border-t border-[#ded7cf] py-4 first:border-t-0 first:pt-0">
    <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#806e60]">
      {label}
    </dt>
    <dd className="mt-1 text-sm leading-6 text-[#51483f]">{children}</dd>
  </div>
)

const NoteLinks = ({
  notes,
  perfumeNotes,
}: {
  notes: string[]
  perfumeNotes: PerfumeTaxonomyItem[]
}) => (
  <>
    {notes.map((note, index) => {
      const noteEntry = perfumeNotes.find(
        (item) => item.name.toLocaleLowerCase() === note.toLocaleLowerCase()
      )

      return (
        <Fragment key={note}>
          {index > 0 && ", "}
          {noteEntry ? (
            <LocalizedClientLink
              href={`/parfyumni-notki/${noteEntry.slug}`}
              className="underline decoration-[#c5b6aa] underline-offset-4 transition hover:text-[#806e60]"
            >
              {note}
            </LocalizedClientLink>
          ) : (
            note
          )}
        </Fragment>
      )
    })}
  </>
)

export default function PerfumeProfileDetails({
  profile,
  perfumeNotes,
}: {
  profile: PerfumeProfile
  perfumeNotes: PerfumeTaxonomyItem[]
}) {
  const hasMainInformation =
    profile.seasons.length > 0 ||
    Boolean(profile.longevity || profile.sillage || profile.gender)
  const hasPyramid =
    profile.notes.top.length > 0 ||
    profile.notes.heart.length > 0 ||
    profile.notes.base.length > 0
  const hasAccords = profile.accords.length > 0
  const visibleColumns = [
    hasMainInformation,
    hasPyramid,
    hasAccords,
  ].filter(Boolean).length
  const gridColumns =
    visibleColumns === 3
      ? "small:grid-cols-3"
      : visibleColumns === 2
        ? "small:grid-cols-2"
        : "small:grid-cols-1"

  return (
    <section className="content-container pb-10 small:pb-14">
      <div className="border-y border-[#ded7cf] py-7 small:py-9">
        <div className={`grid gap-8 small:gap-10 ${gridColumns}`}>
          {hasMainInformation && <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#806e60]">
              Ароматен профил
            </p>
            <h2 className="font-display mt-1 text-2xl">Основна информация</h2>

            <dl className="mt-5">
              {!!profile.seasons.length && (
                <TextDetail label="Подходящ сезон">
                  <span className="flex flex-wrap gap-x-5 gap-y-3">
                    {profile.seasons.map((season) => (
                      <span
                        key={season}
                        className="inline-flex items-center gap-2"
                      >
                        <SeasonIcon season={season} />
                        {seasonLabels[season]}
                      </span>
                    ))}
                  </span>
                </TextDetail>
              )}
              {profile.longevity && (
                <TextDetail label="Трайност">{profile.longevity}</TextDetail>
              )}
              {profile.sillage && (
                <TextDetail label="Проекция">{profile.sillage}</TextDetail>
              )}
              {profile.gender && (
                <TextDetail label="Пол">{profile.gender}</TextDetail>
              )}
            </dl>
          </div>}

          {hasPyramid && <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#806e60]">
              Композиция
            </p>
            <h2 className="font-display mt-1 text-2xl">Парфюмна пирамида</h2>

            <dl className="mt-5">
              {!!profile.notes.top.length && (
                <TextDetail label="Връхни нотки">
                  <NoteLinks notes={profile.notes.top} perfumeNotes={perfumeNotes} />
                </TextDetail>
              )}
              {!!profile.notes.heart.length && (
                <TextDetail label="Сърдечни нотки">
                  <NoteLinks
                    notes={profile.notes.heart}
                    perfumeNotes={perfumeNotes}
                  />
                </TextDetail>
              )}
              {!!profile.notes.base.length && (
                <TextDetail label="Базови нотки">
                  <NoteLinks notes={profile.notes.base} perfumeNotes={perfumeNotes} />
                </TextDetail>
              )}
            </dl>
          </div>}

          {hasAccords && <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#806e60]">
              Ароматен характер
            </p>
            <h2 className="font-display mt-1 text-2xl">Основни акорди</h2>
            <p className="mt-5 text-sm leading-7 text-[#51483f]">
              {profile.accords.join(" · ")}
            </p>
          </div>}
        </div>
      </div>
    </section>
  )
}
