"use client"

import { DeliveryCarrier, DeliveryPoint } from "@lib/util/delivery-point"
import { useEffect, useState } from "react"

type PointPickerProps = {
  carrier: DeliveryCarrier
  shippingOptionId: string
  optionName: string
  selected: DeliveryPoint | null
  onSelect: (point: DeliveryPoint) => void
}

type BoxNowSelection = {
  boxnowLockerId?: string | number
  boxnowLockerName?: string
  boxnowLockerAddressLine1?: string
  boxnowLockerPostalCode?: string
  boxnowLockerCity?: string
  boxnowLockerCityName?: string
}

declare global {
  interface Window {
    _bn_map_widget_config?: {
      parentElement: string
      type: string
      gps: boolean
      autoclose: boolean
      partnerId?: string
      afterSelect: (selected: BoxNowSelection) => void
    }
  }
}

const mapLinks: Record<DeliveryCarrier, string> = {
  econt: "https://officelocator.econt.com/?lang=bg",
  speedy: "https://www.speedy.bg/bg/speedy-offices-automats",
  boxnow: "https://map.boxnow.bg/?countryCode=bg&language=bg",
}

const readString = (value: unknown): string =>
  typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : ""

function parsePoint(
  carrier: DeliveryCarrier,
  shippingOptionId: string,
  raw: unknown,
): DeliveryPoint | null {
  let payloadValue = raw
  if (typeof payloadValue === "string") {
    try {
      payloadValue = JSON.parse(payloadValue)
    } catch {
      return null
    }
  }
  if (!payloadValue || typeof payloadValue !== "object") return null
  const payload = payloadValue as Record<string, unknown>
  let nestedOffice =
    payload.returnedOfficeJsonObject ??
    payload.selectedOffice ??
    payload.office ??
    payload.data
  if (typeof nestedOffice === "string") {
    try {
      nestedOffice = JSON.parse(nestedOffice)
    } catch {
      return null
    }
  }
  const office = (
    nestedOffice && typeof nestedOffice === "object" ? nestedOffice : payload
  ) as Record<string, unknown>
  const location = (
    office.address && typeof office.address === "object" ? office.address : {}
  ) as Record<string, unknown>
  const cityObject = (
    location.city && typeof location.city === "object" ? location.city : {}
  ) as Record<string, unknown>

  const id = readString(
    office.code ||
      office.id ||
      office.officeId ||
      office.officeID ||
      office.officeCode ||
      office.locationId,
  )
  const name = readString(
    office.name ||
      office.officeName ||
      office.nameEn ||
      office.label ||
      office.title ||
      office.locationName,
  )
  const address = readString(
    location.fullAddress ||
      location.fullAddressInfo ||
      location.addressLine ||
      office.fullAddress ||
      office.fullAddressInfo ||
      office.addressText ||
      office.addressLine ||
      (typeof office.address === "string" ? office.address : ""),
  )
  const addressDetails = [
    location.street,
    location.streetName,
    location.streetNo,
    location.address1,
    office.street,
    office.streetName,
    office.address1,
  ]
    .map(readString)
    .filter(Boolean)
    .join(" ")
  const resolvedAddress = address || addressDetails
  const city = readString(
    cityObject.name ||
      location.siteName ||
      office.siteName ||
      office.city ||
      office.town,
  )
  const postalCode = readString(
    cityObject.postCode || office.postCode || office.postalCode,
  )

  if (!id || !name || !resolvedAddress) return null
  return {
    carrier,
    shippingOptionId,
    id,
    name,
    address: resolvedAddress,
    city,
    postalCode,
  }
}

export default function DeliveryPointPicker({
  carrier,
  shippingOptionId,
  optionName,
  selected,
  onSelect,
}: PointPickerProps) {
  const [mapError, setMapError] = useState(false)
  const [shopUrl, setShopUrl] = useState("")
  const [manualOpen, setManualOpen] = useState(false)
  const [manualCity, setManualCity] = useState("")
  const [manualName, setManualName] = useState("")
  const [manualAddress, setManualAddress] = useState("")
  const [manualCode, setManualCode] = useState("")
  const hasBoxNowPartnerId = Boolean(process.env.NEXT_PUBLIC_BOXNOW_PARTNER_ID)

  useEffect(() => setShopUrl(window.location.origin), [])

  useEffect(() => {
    if (carrier !== "econt" && carrier !== "speedy") return

    const allowedOrigin =
      carrier === "econt"
        ? "https://officelocator.econt.com"
        : "https://services.speedy.bg"
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== allowedOrigin) return
      let payload: unknown = event.data
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload)
        } catch {
          return
        }
      }
      const point = parsePoint(carrier, shippingOptionId, payload)
      if (point) onSelect(point)
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [carrier, shippingOptionId, onSelect])

  useEffect(() => {
    if (carrier !== "boxnow" || !hasBoxNowPartnerId) return

    window._bn_map_widget_config = {
      parentElement: "#boxnow-checkout-map",
      type: "iframe",
      gps: false,
      autoclose: false,
      partnerId: process.env.NEXT_PUBLIC_BOXNOW_PARTNER_ID,
      afterSelect: (selection) => {
        const id = readString(selection.boxnowLockerId)
        const address = readString(selection.boxnowLockerAddressLine1)
        if (!id || !address) return
        onSelect({
          carrier: "boxnow",
          shippingOptionId,
          id,
          name:
            readString(selection.boxnowLockerName) || `BOX NOW автомат № ${id}`,
          address,
          city: readString(
            selection.boxnowLockerCity || selection.boxnowLockerCityName,
          ),
          postalCode: readString(selection.boxnowLockerPostalCode),
        })
      },
    }

    const script = document.createElement("script")
    script.src = "https://widget-cdn.boxnow.gr/map-widget/client/v5.js"
    script.async = true
    script.onerror = () => setMapError(true)
    document.head.appendChild(script)

    return () => {
      script.remove()
      delete window._bn_map_widget_config
    }
  }, [carrier, shippingOptionId, onSelect, hasBoxNowPartnerId])

  const speedyType = optionName.toLocaleLowerCase("bg-BG").includes("автомат")
    ? "APT"
    : "OFFICE"
  const econtType = optionName.toLocaleLowerCase("bg-BG").includes("автомат")
    ? "aps"
    : "office"
  const mapUrl =
    carrier === "econt"
      ? `https://officelocator.econt.com/?shopUrl=${encodeURIComponent(shopUrl)}&officeType=${econtType}&lang=bg`
      : `https://services.speedy.bg/office_locator_widget_v3/office_locator.php?lang=bg&countryId=100&pickUp=1&officeType=${speedyType}`

  return (
    <div className="mt-4 border-t border-[#ded7cf] pt-4">
      <p className="mb-3 text-sm font-semibold text-[#211d19]">
        {carrier === "boxnow" && !hasBoxNowPartnerId
          ? "Избор на BOX NOW автомат"
          : `Изберете ${carrier === "boxnow" ? "автомат" : "офис или автомат"} от картата`}
      </p>
      {selected?.shippingOptionId === shippingOptionId && (
        <div className="mb-3 border border-[#c7b7a6] bg-[#f8f3ed] p-3 text-sm text-[#211d19]">
          <strong>{selected.name}</strong>
          <p className="mt-1 text-[#62584f]">{selected.address}</p>
          <p className="text-xs text-[#806e60]">Код на обекта: {selected.id}</p>
        </div>
      )}
      {carrier === "boxnow" && !hasBoxNowPartnerId ? (
        <div className="border border-[#ded7cf] bg-[#f8f3ed] p-4 text-sm leading-6 text-[#62584f]">
          <p className="font-semibold text-[#211d19]">Картата очаква настройка</p>
          <p className="mt-1">
            Вградената карта се активира с BOX NOW партньорски идентификатор.
            Засега отворете официалната карта и въведете избрания автомат по-долу.
          </p>
        </div>
      ) : carrier === "boxnow" ? (
        <div
          id="boxnow-checkout-map"
          className="min-h-[360px] overflow-hidden bg-[#f8f3ed]"
        />
      ) : carrier === "econt" && !shopUrl ? (
        <div className="h-[460px] bg-[#f8f3ed]" />
      ) : (
        <iframe
          title={`Избор на обект на ${carrier === "econt" ? "Еконт" : "Спиди"}`}
          src={mapUrl}
          allow="geolocation"
          className="h-[460px] w-full border border-[#ded7cf] bg-white"
          onError={() => setMapError(true)}
        />
      )}
      {mapError && (
        <p className="mt-2 text-sm text-red-700">
          Картата не се зареди. Опитайте отново по-късно.
        </p>
      )}
      <a
        href={mapLinks[carrier]}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block text-sm text-[#62584f] underline underline-offset-4"
      >
        Отворете картата в нов прозорец
      </a>
      <div className="mt-4 border-t border-[#ded7cf] pt-4">
        <button
          type="button"
          onClick={() => setManualOpen((open) => !open)}
          className="text-sm font-semibold text-[#211d19] underline underline-offset-4"
        >
          {manualOpen ? "Скрий ръчното въвеждане" : "Въведи обекта ръчно"}
        </button>
        {manualOpen && (
          <form
            className="mt-3 grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              const city = manualCity.trim()
              const name = manualName.trim()
              const address = manualAddress.trim()
              if (!city || !name || !address) return
              onSelect({
                carrier,
                shippingOptionId,
                id: manualCode.trim() || "manual",
                name,
                address,
                city,
              })
              setManualOpen(false)
            }}
          >
            <label className="text-xs font-medium text-[#62584f]">
              Град *
              <input
                required
                value={manualCity}
                onChange={(event) => setManualCity(event.target.value)}
                className="mt-1 w-full border border-[#ded7cf] bg-white px-3 py-2 text-sm text-[#211d19]"
                autoComplete="address-level2"
              />
            </label>
            <label className="text-xs font-medium text-[#62584f]">
              Име на обекта *
              <input
                required
                value={manualName}
                onChange={(event) => setManualName(event.target.value)}
                className="mt-1 w-full border border-[#ded7cf] bg-white px-3 py-2 text-sm text-[#211d19]"
              />
            </label>
            <label className="text-xs font-medium text-[#62584f] sm:col-span-2">
              Адрес на офиса или автомата *
              <input
                required
                value={manualAddress}
                onChange={(event) => setManualAddress(event.target.value)}
                className="mt-1 w-full border border-[#ded7cf] bg-white px-3 py-2 text-sm text-[#211d19]"
                autoComplete="street-address"
              />
            </label>
            <label className="text-xs font-medium text-[#62584f] sm:col-span-2">
              Код на обекта (ако е показан)
              <input
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value)}
                className="mt-1 w-full border border-[#ded7cf] bg-white px-3 py-2 text-sm text-[#211d19]"
              />
            </label>
            <p className="text-xs leading-5 text-[#806e60] sm:col-span-2">
              Препишете данните от локатора на избрания куриер. Ръчно въведеният
              обект няма автоматична проверка при куриера.
            </p>
            <button
              type="submit"
              className="border border-[#211d19] bg-[#211d19] px-4 py-2 text-sm font-semibold text-white sm:col-span-2 sm:justify-self-start"
            >
              Потвърди обекта
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
