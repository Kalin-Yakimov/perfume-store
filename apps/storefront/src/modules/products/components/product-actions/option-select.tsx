import { HttpTypes } from "@medusajs/types"
import { formatVolumeForDisplay } from "@lib/util/format-volume-for-display"
import React from "react"

type OptionSelectProps = {
  option: HttpTypes.StoreProductOption
  current: string | undefined
  updateOption: (title: string, value: string) => void
  title: string
  disabled: boolean
  allowedValues?: string[]
  unavailableValues?: string[]
  "data-testid"?: string
}

const OptionSelect: React.FC<OptionSelectProps> = ({
  option,
  current,
  updateOption,
  title,
  "data-testid": dataTestId,
  disabled,
  allowedValues,
  unavailableValues,
}) => {
  const filteredOptions = (option.values ?? [])
    .map((v) => v.value)
    .filter((value) => !allowedValues || allowedValues.includes(value))
    .sort((a, b) => {
      const volume = (value: string) => {
        const match = value.match(/^\s*(\d+(?:[.,]\d+)?)\s*(?:ml|мл)(?:\s|$)/i)
        return match ? Number(match[1].replace(",", ".")) : null
      }
      const aVolume = volume(a)
      const bVolume = volume(b)
      return aVolume !== null && bVolume !== null ? aVolume - bVolume : 0
    })

  return (
    <div className="flex flex-col gap-y-3">
      <span className="text-sm font-medium text-[#302a25]">
        Изберете{" "}
        {title === "Volume" ? "разфасовка" : title.toLocaleLowerCase("bg")}:
      </span>
      <div
        className="flex flex-wrap justify-start gap-2"
        data-testid={dataTestId}
      >
        {filteredOptions.map((v) => {
          const unavailable = unavailableValues?.includes(v) ?? false
          return (
            <button
              type="button"
              onClick={() => updateOption(option.id, v)}
              key={v}
              className={`inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border px-4 text-sm text-[#302a25] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                v === current
                  ? "border-[#2a241f] bg-[#f0e9e1] font-bold shadow-sm"
                  : "border-[#cfc5ba] bg-[#fffdf9] hover:border-[#8d735f] hover:bg-[#f3eee8]"
              }`}
              disabled={disabled || unavailable}
              data-testid="option-button"
            >
              {formatVolumeForDisplay(v)}
              {unavailable ? " · Изчерпан" : ""}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default OptionSelect
