"use client"
import { RadioGroup } from "@headlessui/react"
import { isManual, isStripeLike, paymentInfoMap } from "@lib/constants"
import { initiatePaymentSession } from "@lib/data/cart"
import { CheckCircleSolid, CreditCard } from "@medusajs/icons"
import ErrorMessage from "@modules/checkout/components/error-message"
import PaymentContainer, {
  StripePaymentContainer,
} from "@modules/checkout/components/payment-container"
import {
  Button,
  Container,
  Heading,
  Text,
  clx,
} from "@modules/common/components/ui"
import { HttpTypes } from "@medusajs/types"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

const Payment = ({
  cart,
  availablePaymentMethods,
}: {
  cart: HttpTypes.StoreCart
  availablePaymentMethods: { id: string }[]
}) => {
  const activeSession = cart.payment_collection?.payment_sessions?.find(
    (paymentSession) => paymentSession.status === "pending",
  )

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentComplete, setPaymentComplete] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    activeSession?.provider_id ?? "",
  )

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "payment"
  const deliveryName =
    cart.shipping_methods?.at(-1)?.name?.toLocaleLowerCase("bg-BG") || ""
  const isLocker =
    deliveryName.includes("автомат") ||
    deliveryName.includes("boxnow") ||
    deliveryName.includes("box now")
  const paymentMethods = availablePaymentMethods.filter(
    (method) =>
      // The built-in Medusa manual provider is useful for local order-flow
      // checks, but it is not a production cash-on-delivery integration.
      (!isManual(method.id) || process.env.NODE_ENV === "development") &&
      (!isLocker || !isManual(method.id)),
  )

  const setPaymentMethod = async (method: string) => {
    setError(null)
    setSelectedPaymentMethod(method)
    if (isStripeLike(method)) {
      await initiatePaymentSession(cart, {
        provider_id: method,
      })
    }
  }

  const paidByGiftcard = !!(
    (cart as unknown as Record<string, unknown>)?.gift_cards &&
    ((cart as unknown as Record<string, unknown>)?.gift_cards as unknown[])
      ?.length > 0 &&
    cart?.total === 0
  )

  const paymentReady =
    (activeSession && (cart?.shipping_methods?.length ?? 0) !== 0) ||
    paidByGiftcard

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams)
      params.set(name, value)

      return params.toString()
    },
    [searchParams],
  )

  const handleEdit = () => {
    router.push(pathname + "?" + createQueryString("step", "payment"), {
      scroll: false,
    })
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      const shouldInputPaymentDetails =
        isStripeLike(selectedPaymentMethod) && !activeSession

      const checkActiveSession =
        activeSession?.provider_id === selectedPaymentMethod

      if (!checkActiveSession) {
        await initiatePaymentSession(cart, {
          provider_id: selectedPaymentMethod,
        })
      }

      if (!shouldInputPaymentDetails) {
        return router.push(
          pathname + "?" + createQueryString("step", "address"),
          {
            scroll: false,
          },
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setError(null)
  }, [isOpen])

  useEffect(() => {
    const step = searchParams.get("step")
    const hasShippingMethod = (cart.shipping_methods?.length ?? 0) > 0
    if (!hasShippingMethod && step && step !== "delivery") {
      router.replace(`${pathname}?step=delivery`, { scroll: false })
      return
    }

    if (
      hasShippingMethod &&
      !activeSession &&
      (step === "address" || step === "review")
    ) {
      router.replace(`${pathname}?step=payment`, { scroll: false })
    }
  }, [
    activeSession,
    cart.shipping_methods,
    pathname,
    router,
    searchParams,
  ])

  return (
    <div>
      <div className="flex flex-row items-center justify-between mb-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#826c5a]">
            02 · Начин на плащане
          </p>
          <Heading
            level="h2"
            className={clx(
              "font-display mt-2 flex items-center gap-2 text-2xl font-normal text-[#211d19]",
              {
                "opacity-50 pointer-events-none select-none":
                  !isOpen && !paymentReady,
              },
            )}
          >
            Плащане
            {!isOpen && paymentReady && <CheckCircleSolid />}
          </Heading>
        </div>
        {!isOpen && paymentReady && (
          <Text>
            <button
              onClick={handleEdit}
              className="text-sm font-medium text-[#806e60] underline underline-offset-4 hover:text-[#211d19]"
              data-testid="edit-payment-button"
            >
              Редактирай
            </button>
          </Text>
        )}
      </div>
      <div>
        <div className={isOpen ? "block" : "hidden"}>
          {!paidByGiftcard && paymentMethods.length > 0 && (
            <>
              <p className="mb-4 text-sm leading-6 text-[#62584f]">
                Онлайн плащането показва само методите, активирани от платежния
                оператор. Ако той поддържа Apple Pay или Google Pay за вашия
                домейн и акаунт, те ще се появят в защитения прозорец за плащане.
              </p>
              <RadioGroup
                value={selectedPaymentMethod}
                onChange={(value: string) => setPaymentMethod(value)}
              >
                {paymentMethods.map((paymentMethod) => (
                  <div key={paymentMethod.id}>
                    {isStripeLike(paymentMethod.id) ? (
                      <StripePaymentContainer
                        paymentProviderId={paymentMethod.id}
                        selectedPaymentOptionId={selectedPaymentMethod}
                        paymentInfoMap={paymentInfoMap}
                        setError={setError}
                        setPaymentComplete={setPaymentComplete}
                      />
                    ) : (
                      <PaymentContainer
                        paymentInfoMap={paymentInfoMap}
                        paymentProviderId={paymentMethod.id}
                        selectedPaymentOptionId={selectedPaymentMethod}
                      />
                    )}
                  </div>
                ))}
              </RadioGroup>
            </>
          )}

          {isLocker && (
            <p className="mt-3 text-xs leading-5 text-[#806e60]">
              При автомат не се приема плащане в брой. Показват се само
              наличните онлайн начини на плащане.
            </p>
          )}
          {!paidByGiftcard && paymentMethods.length === 0 && (
            <p className="mt-3 border border-[#ded7cf] bg-[#fbf9f6] p-4 text-sm text-[#62584f]">
              За момента няма активиран платежен оператор за тази доставка.
              Онлайн карти, Revolut, Apple Pay и Google Pay изискват настройка
              на реален оператор; наложеният платеж изисква отделна интеграция
              с куриера.
            </p>
          )}

          {paidByGiftcard && (
            <div className="flex flex-col w-1/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Начин на плащане
              </Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method-summary"
              >
                Подаръчна карта
              </Text>
            </div>
          )}

          <ErrorMessage
            error={error}
            data-testid="payment-method-error-message"
          />

          <Button
            size="large"
            className="mt-6"
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={
              (isStripeLike(selectedPaymentMethod) && !paymentComplete) ||
              (!selectedPaymentMethod && !paidByGiftcard) ||
              (isLocker && isManual(selectedPaymentMethod)) ||
              (!paidByGiftcard && paymentMethods.length === 0)
            }
            data-testid="submit-payment-button"
          >
            {!activeSession && isStripeLike(selectedPaymentMethod)
              ? "Въведи данни за плащане"
              : "Продължи към лични данни"}
          </Button>
        </div>

        <div className={isOpen ? "hidden" : "block"}>
          {cart && paymentReady && activeSession ? (
            <div className="flex items-start gap-x-1 w-full">
              <div className="flex flex-col min-w-0">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">
                  Начин на плащане
                </Text>
                <Text
                  className="txt-medium text-ui-fg-subtle"
                  data-testid="payment-method-summary"
                >
                  {paymentInfoMap[activeSession?.provider_id]?.title ||
                    activeSession?.provider_id}
                </Text>
              </div>
              <div className="flex flex-col min-w-0">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">
                  Данни за плащане
                </Text>
                <div
                  className="flex gap-2 txt-medium text-ui-fg-subtle items-center"
                  data-testid="payment-details-summary"
                >
                  <Container className="flex items-center h-7 w-fit p-2 bg-ui-button-neutral-hover">
                    {paymentInfoMap[selectedPaymentMethod]?.icon || (
                      <CreditCard />
                    )}
                  </Container>
                  <Text>Плащането се потвърждава на следващата стъпка.</Text>
                </div>
              </div>
            </div>
          ) : paidByGiftcard ? (
            <div className="flex flex-col min-w-0">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Начин на плащане
              </Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method-summary"
              >
                Подаръчна карта
              </Text>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default Payment
