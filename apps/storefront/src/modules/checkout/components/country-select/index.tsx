import { forwardRef, useImperativeHandle, useMemo, useRef } from "react"

import NativeSelect, {
  NativeSelectProps,
} from "@modules/common/components/native-select"
import { HttpTypes } from "@medusajs/types"

const CountrySelect = forwardRef<
  HTMLSelectElement,
  NativeSelectProps & {
    region?: HttpTypes.StoreRegion
  }
>(({ placeholder = "Country", region, defaultValue, ...props }, ref) => {
  const innerRef = useRef<HTMLSelectElement>(null)

  useImperativeHandle<HTMLSelectElement | null, HTMLSelectElement | null>(
    ref,
    () => innerRef.current,
  )

  const countryOptions = useMemo(() => {
    if (!region) {
      return []
    }

    const names = new Intl.DisplayNames(["bg"], { type: "region" })

    return region.countries?.map((country) => ({
      value: country.iso_2,
      label: country.iso_2
        ? names.of(country.iso_2.toUpperCase()) || country.display_name
        : country.display_name,
    }))
  }, [region])

  return (
    <NativeSelect
      ref={innerRef}
      className="border-[#d9ccbf] bg-[#fffdf9] text-[#302a25]"
      placeholder={placeholder}
      defaultValue={defaultValue}
      {...props}
    >
      {countryOptions?.map(({ value, label }, index) => (
        <option key={index} value={value}>
          {label}
        </option>
      ))}
    </NativeSelect>
  )
})

CountrySelect.displayName = "CountrySelect"

export default CountrySelect
