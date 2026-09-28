"use client"

import { setDeliveryChoice } from "@lib/data/cart"
import { calculatePriceForShippingOption } from "@lib/data/fulfillment"
import { convertToLocale } from "@lib/util/money"
import {
  DeliveryPoint,
  getDeliveryCarrier,
  needsDeliveryPoint,
  readDeliveryPoint,
} from "@lib/util/delivery-point"
import { HttpTypes } from "@medusajs/types"
import DeliveryPointPicker from "@modules/checkout/components/delivery-point-picker"
import ErrorMessage from "@modules/checkout/components/error-message"
import { Button } from "@modules/common/components/ui"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

type ShippingProps = {
  cart: HttpTypes.StoreCart
  availableShippingMethods: HttpTypes.StoreCartShippingOption[] | null
}

export default function Shipping({
  cart,
  availableShippingMethods,
}: ShippingProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isOpen =
    !searchParams.get("step") || searchParams.get("step") === "delivery"
  const savedOptionId = cart.shipping_methods?.at(-1)?.shipping_option_id || ""
  const savedPoint = readDeliveryPoint(cart.metadata?.delivery_point)
  const [selectedId, setSelectedId] = useState(savedOptionId)
  const [point, setPoint] = useState<DeliveryPoint | null>(savedPoint)
  const [showMap, setShowMap] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [calculatedPrices, setCalculatedPrices] = useState<
    Record<string, number>
  >({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSelectedId(savedOptionId)
    setPoint(savedPoint)
    setShowMap(false)
  }, [savedOptionId, savedPoint?.id, savedPoint?.shippingOptionId])

  const options = availableShippingMethods || []
  const selectedOption = options.find((option) => option.id === selectedId)
  const savedOption = options.find((option) => option.id === savedOptionId)
  const requiresPoint = selectedOption
    ? needsDeliveryPoint(selectedOption.name)
    : false
  const carrier = selectedOption
    ? getDeliveryCarrier(selectedOption.name)
    : null

  const groups = useMemo(
    () =>
      [
        {
          label: "Получаване от офис или автомат",
          options: options.filter((option) => needsDeliveryPoint(option.name)),
        },
        {
          label: "Доставка до адрес или лично вземане",
          options: options.filter((option) => !needsDeliveryPoint(option.name)),
        },
      ].filter((group) => group.options.length > 0),
    [options],
  )
  const configuredCarriers = new Set(
    options
      .map((option) => getDeliveryCarrier(option.name))
      .filter((value): value is NonNullable<typeof value> => value !== null),
  )
  const courierSetup = [
    { id: "econt", name: "Еконт", description: "Офис или автомат" },
    { id: "speedy", name: "Спиди", description: "Офис или автомат" },
    { id: "boxnow", name: "BOX NOW", description: "Пощенски автомат" },
  ] as const

  useEffect(() => {
    let active = true
    const calculated = options.filter(
      (option) => option.price_type === "calculated",
    )
    if (!calculated.length) return
    Promise.all(
      calculated.map(async (option) => {
        const result = await calculatePriceForShippingOption(option.id, cart.id)
        return [option.id, result?.amount] as const
      }),
    ).then((results) => {
      if (!active) return
      setCalculatedPrices(
        Object.fromEntries(
          results.filter((entry) => typeof entry[1] === "number"),
        ) as Record<string, number>,
      )
    })
    return () => {
      active = false
    }
  }, [availableShippingMethods, cart.id])

  useEffect(() => {
    const currentStep = searchParams.get("step")
    if (!savedOptionId && currentStep && currentStep !== "delivery") {
      router.replace(`${pathname}?step=delivery`, { scroll: false })
    }
  }, [pathname, router, savedOptionId, searchParams])

  const handlePointSelected = useCallback((nextPoint: DeliveryPoint) => {
    setPoint(nextPoint)
    setError(null)
    setShowMap(false)
  }, [])

  const chooseOption = (option: HttpTypes.StoreCartShippingOption) => {
    setSelectedId(option.id)
    setPoint(option.id === point?.shippingOptionId ? point : null)
    setShowMap(needsDeliveryPoint(option.name))
    setError(null)
  }

  const handleSubmit = async () => {
    if (!selectedOption) return
    setIsLoading(true)
    setError(null)
    try {
      await setDeliveryChoice({
        shippingMethodId: selectedOption.id,
        point: requiresPoint ? point : null,
      })
      router.push(`${pathname}?step=payment`, { scroll: false })
      router.refresh()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Доставката не можа да се запази.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#826c5a]">
            01 · България
          </p>
          <h2 className="font-display mt-2 text-2xl text-[#211d19]">
            Доставка
          </h2>
        </div>
        {!isOpen && savedOptionId && (
          <button
            type="button"
            onClick={() =>
              router.push(`${pathname}?step=delivery`, { scroll: false })
            }
            className="text-sm font-medium text-[#806e60] underline underline-offset-4"
            data-testid="edit-delivery-button"
          >
            Редактирай
          </button>
        )}
      </div>

      {isOpen ? (
        <>
          <p className="mb-5 text-sm leading-6 text-[#62584f]">
            Изберете куриер и начин на получаване. Цената се показва след като
            съответната услуга бъде настроена в магазина.
          </p>
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-semibold text-[#211d19]">
              Доставка до офис или автомат
            </h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {courierSetup.map((courier) => {
                const configured = configuredCarriers.has(courier.id)
                return (
                  <div
                    key={courier.id}
                    aria-disabled={!configured}
                    className={`border px-4 py-3 ${configured ? "border-[#806e60] bg-[#f8f3ed]" : "border-[#ded7cf] bg-[#fbf9f6]"}`}
                  >
                    <p className="text-sm font-semibold text-[#211d19]">
                      {courier.name}
                    </p>
                    <p className="mt-1 text-xs text-[#62584f]">
                      {courier.description}
                    </p>
                    <p className="mt-2 text-xs font-medium text-[#806e60]">
                      {configured ? "Настроен за избор по-долу" : "Очаква настройка на тарифа"}
                    </p>
                  </div>
                )
              })}
            </div>
            {!courierSetup.some((courier) => configuredCarriers.has(courier.id)) && (
              <p className="mt-3 border-l-2 border-[#bda894] bg-[#fbf9f6] px-3 py-2 text-xs leading-5 text-[#62584f]">
                Засега няма свързани тарифи за тези куриери. За да не бъде
                избрана грешна цена, общите методи, които са настроени в
                магазина, са показани отделно по-долу.
              </p>
            )}
          </div>
          {groups.length ? (
            groups.map((group) => (
              <div key={group.label} className="mb-6">
                <h3 className="mb-3 text-sm font-semibold text-[#211d19]">
                  {group.options.some((option) => !getDeliveryCarrier(option.name))
                    ? "Други настроени методи (без куриерска интеграция)"
                    : group.label}
                </h3>
                <div
                  className="space-y-2"
                  role="radiogroup"
                  aria-label={group.label}
                  data-testid="delivery-options-container"
                >
                  {group.options.map((option) => {
                    const price =
                      option.price_type === "flat"
                        ? option.amount
                        : calculatedPrices[option.id]
                    const disabled =
                      option.insufficient_inventory || typeof price !== "number"
                    const checked = selectedId === option.id
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        disabled={disabled}
                        onClick={() => chooseOption(option)}
                        className={`flex w-full items-center gap-4 border px-4 py-4 text-left transition ${checked ? "border-[#806e60] bg-[#f8f3ed]" : "border-[#ded7cf] bg-white hover:border-[#bda894]"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                        data-testid="delivery-option-radio"
                      >
                        <span
                          aria-hidden="true"
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${checked ? "border-[#211d19]" : "border-[#aa9a89]"}`}
                        >
                          {checked && (
                            <span className="h-2 w-2 rounded-full bg-[#211d19]" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 text-sm font-medium text-[#211d19]">
                          {option.name}
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-[#211d19]">
                          {typeof price === "number"
                            ? convertToLocale({
                                amount: price,
                                currency_code: cart.currency_code,
                              })
                            : "—"}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          ) : (
            <p className="border border-[#ded7cf] bg-[#fbf9f6] p-4 text-sm text-[#62584f]">
              Все още няма настроен начин на доставка за тази кошница.
            </p>
          )}

          {requiresPoint && carrier && selectedOption && (
            <div className="mb-5 border border-[#ded7cf] bg-[#fffdf9] p-4">
              {point?.shippingOptionId === selectedId && (
                <div className="text-sm text-[#211d19]">
                  <strong>{point.name}</strong>
                  <span className="ml-2 text-[#62584f]">{point.address}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowMap(!showMap)}
                className="mt-2 text-sm font-semibold text-[#211d19] underline underline-offset-4"
              >
                {point?.shippingOptionId === selectedId
                  ? "Промени обекта"
                  : "Избери обект от карта"}
              </button>
              {showMap && (
                <DeliveryPointPicker
                  carrier={carrier}
                  shippingOptionId={selectedId}
                  optionName={selectedOption.name}
                  selected={point}
                  onSelect={handlePointSelected}
                />
              )}
              {point?.shippingOptionId === selectedId && !point.city && (
                <label className="mt-4 block text-sm font-medium text-[#211d19]">
                  Населено място на обекта
                  <input
                    value={point.city}
                    onChange={(event) =>
                      setPoint({ ...point, city: event.target.value })
                    }
                    className="mt-2 w-full border border-[#ded7cf] bg-white px-3 py-2 text-sm"
                    required
                  />
                </label>
              )}
            </div>
          )}

          <ErrorMessage
            error={error}
            data-testid="delivery-option-error-message"
          />
          <Button
            size="large"
            className="mt-3"
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={
              !selectedOption ||
              (requiresPoint && (!point || !point.city.trim()))
            }
            data-testid="submit-delivery-option-button"
          >
            Продължи към плащане
          </Button>
        </>
      ) : savedOption ? (
        <div className="text-sm leading-6 text-[#62584f]">
          <p className="font-medium text-[#211d19]">{savedOption.name}</p>
          {savedPoint?.shippingOptionId === savedOptionId && (
            <p>
              {savedPoint.name}, {savedPoint.address}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-[#806e60]">
          Първо изберете начин на доставка.
        </p>
      )}
    </div>
  )
}
