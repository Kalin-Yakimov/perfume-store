"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { FormEvent, ReactNode, useEffect, useState } from "react"

const filterGroups = [
  {
    title: "Пол",
    key: "gender",
    options: [
      ["male", "Мъжки"],
      ["female", "Женски"],
      ["unisex", "Унисекс"],
    ],
  },
  {
    title: "Сезон",
    key: "season",
    options: [
      ["winter", "Зима"],
      ["spring", "Пролет"],
      ["summer", "Лято"],
      ["autumn", "Есен"],
    ],
  },
]

export default function PerfumeFilters({
  children,
  brands,
  priceMax,
}: {
  children?: ReactNode
  brands: { value: string; label: string }[]
  priceMax: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentMin = Number(searchParams.get("minPrice") ?? 0)
  const currentMax = Number(searchParams.get("maxPrice") ?? priceMax)
  const [minPrice, setMinPrice] = useState(currentMin)
  const [maxPrice, setMaxPrice] = useState(Math.min(currentMax, priceMax))

  useEffect(() => {
    setMinPrice(Math.min(currentMin, priceMax))
    setMaxPrice(Math.min(currentMax, priceMax))
  }, [currentMin, currentMax, priceMax])

  const updateParams = (updater: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString())
    updater(params)
    params.delete("page")

    const queryString = params.toString()
    router.push(queryString ? `${pathname}?${queryString}` : pathname)
  }

  const toggleValue = (key: string, value: string) => {
    updateParams((params) => {
      const selectedValues = params.getAll(key)
      params.delete(key)

      const nextValues = selectedValues.includes(value)
        ? selectedValues.filter((item) => item !== value)
        : [...selectedValues, value]

      nextValues.forEach((item) => params.append(key, item))
    })
  }

  const applyPrice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedMin = Math.max(0, Math.min(minPrice, maxPrice))
    const normalizedMax = Math.min(priceMax, Math.max(maxPrice, normalizedMin))
    setMinPrice(normalizedMin)
    setMaxPrice(normalizedMax)

    updateParams((params) => {
      if (normalizedMin > 0) params.set("minPrice", String(normalizedMin))
      else params.delete("minPrice")

      if (normalizedMax < priceMax)
        params.set("maxPrice", String(normalizedMax))
      else params.delete("maxPrice")
    })
  }

  const clearFilters = () => {
    setMinPrice(0)
    setMaxPrice(priceMax)

    updateParams((params) => {
      const filterKeys = ["gender", "brand", "season", "minPrice", "maxPrice"]
      filterKeys.forEach((key) => params.delete(key))
    })
  }

  const hasActiveFilters = [
    "gender",
    "brand",
    "season",
    "minPrice",
    "maxPrice",
  ].some((key) => searchParams.has(key))

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between pb-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em]">
          Филтри
        </h2>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-[10px] uppercase tracking-[0.12em] text-[#806e60] underline underline-offset-4"
          >
            Изчисти
          </button>
        )}
      </div>

      {children && (
        <div className="border-t border-[#d4c9be] py-5">{children}</div>
      )}

      {filterGroups.slice(0, 1).map((group) => (
        <fieldset key={group.key} className="border-t border-[#d4c9be] py-5">
          <legend className="mb-4 text-sm font-semibold">{group.title}</legend>
          <div className="space-y-3">
            {group.options.map(([value, label]) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-3 text-sm text-[#61564d]"
              >
                <input
                  type="checkbox"
                  checked={searchParams.getAll(group.key).includes(value)}
                  onChange={() => toggleValue(group.key, value)}
                  className="h-4 w-4 rounded-sm border-[#a89687] accent-[#382f29]"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {brands.length > 0 && (
        <fieldset className="border-t border-[#d4c9be] py-5">
          <legend className="mb-4 text-sm font-semibold">Марка</legend>
          <div className="max-h-52 space-y-3 overflow-y-auto">
            {brands.map((brand) => (
              <label
                key={brand.value}
                className="flex cursor-pointer items-center gap-3 text-sm text-[#61564d]"
              >
                <input
                  type="checkbox"
                  checked={searchParams
                    .getAll("brand")
                    .some(
                      (value) => value === brand.value || value === brand.label,
                    )}
                  onChange={() =>
                    updateParams((params) => {
                      const selected = params.getAll("brand")
                      const checked = selected.some(
                        (value) =>
                          value === brand.value || value === brand.label,
                      )
                      params.delete("brand")
                      selected
                        .filter(
                          (value) =>
                            value !== brand.value && value !== brand.label,
                        )
                        .forEach((value) => params.append("brand", value))
                      if (!checked) params.append("brand", brand.value)
                    })
                  }
                  className="h-4 w-4 rounded-sm border-[#a89687] accent-[#382f29]"
                />
                {brand.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <form onSubmit={applyPrice} className="border-t border-[#d4c9be] py-5">
        <h3 className="text-sm font-semibold">Цена</h3>
        <div className="mt-5 space-y-5">
          <label className="block text-xs text-[#70645a]">
            От
            <input
              type="range"
              min="0"
              max={priceMax}
              step="5"
              value={minPrice}
              onChange={(event) =>
                setMinPrice(Math.min(Number(event.target.value), maxPrice))
              }
              className="mt-2 w-full accent-[#382f29]"
            />
          </label>
          <label className="block text-xs text-[#70645a]">
            До
            <input
              type="range"
              min="0"
              max={priceMax}
              step="5"
              value={maxPrice}
              onChange={(event) =>
                setMaxPrice(Math.max(Number(event.target.value), minPrice))
              }
              className="mt-2 w-full accent-[#382f29]"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="text-[10px] uppercase tracking-[0.12em] text-[#817267]">
            От
            <div className="mt-1 flex items-center border border-[#d4cbc2] bg-white px-3">
              <input
                type="number"
                min="0"
                max={priceMax}
                value={minPrice}
                onChange={(event) =>
                  setMinPrice(Math.min(Number(event.target.value), maxPrice))
                }
                className="h-10 min-w-0 w-full bg-transparent pr-3 text-sm tabular-nums outline-none"
              />
              <span className="shrink-0 text-sm">€</span>
            </div>
          </label>
          <label className="text-[10px] uppercase tracking-[0.12em] text-[#817267]">
            До
            <div className="mt-1 flex items-center border border-[#d4cbc2] bg-white px-3">
              <input
                type="number"
                min="0"
                max={priceMax}
                value={maxPrice}
                onChange={(event) =>
                  setMaxPrice(Math.max(Number(event.target.value), minPrice))
                }
                className="h-10 min-w-0 w-full bg-transparent pr-3 text-sm tabular-nums outline-none"
              />
              <span className="shrink-0 text-sm">€</span>
            </div>
          </label>
        </div>

        <button
          type="submit"
          className="mt-3 h-10 w-full bg-[#382f29] text-[10px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#59493d]"
        >
          Приложи цена
        </button>
      </form>

      {filterGroups.slice(1).map((group) => (
        <fieldset key={group.key} className="border-t border-[#d4c9be] py-5">
          <legend className="mb-4 text-sm font-semibold">{group.title}</legend>
          <div className="space-y-3">
            {group.options.map(([value, label]) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-3 text-sm text-[#61564d]"
              >
                <input
                  type="checkbox"
                  checked={searchParams.getAll(group.key).includes(value)}
                  onChange={() => toggleValue(group.key, value)}
                  className="h-4 w-4 rounded-sm border-[#a89687] accent-[#382f29]"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  )
}
