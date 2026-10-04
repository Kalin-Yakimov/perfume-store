"use client"

import { addToCart } from "@lib/data/cart"
import { getDecantAvailability } from "@lib/data/decant-stock"
import { getCustomerVariants } from "@lib/util/customer-variants"
import { useIntersection } from "@lib/hooks/use-in-view"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@modules/common/components/ui"
import Divider from "@modules/common/components/divider"
import OptionSelect from "@modules/products/components/product-actions/option-select"
import { isEqual } from "lodash"
import { useParams, usePathname, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ProductPrice from "../product-price"
import MobileActions from "./mobile-actions"
import QuantitySelector from "./quantity-selector"
import { useRouter } from "next/navigation"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  disabled?: boolean
}

const optionsAsKeymap = (
  variantOptions: HttpTypes.StoreProductVariant["options"],
) => {
  return variantOptions?.reduce((acc: Record<string, string>, varopt) => {
    if (varopt.option_id) acc[varopt.option_id] = varopt.value
    return acc
  }, {})
}

export default function ProductActions({
  product,
  disabled,
}: ProductActionsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [options, setOptions] = useState<Record<string, string | undefined>>({})
  const [isAdding, setIsAdding] = useState(false)
  const [quantity, setQuantity] = useState("1")
  const [stockStatus, setStockStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  )
  const [decantAvailability, setDecantAvailability] = useState<
    Record<string, boolean>
  >({})
  const [decantMaxQuantity, setDecantMaxQuantity] = useState<
    Record<string, number>
  >({})
  const [addError, setAddError] = useState("")
  const countryCode = useParams().countryCode as string
  const isDecant = product.metadata?.listing_type === "decant"

  const refreshDecantAvailability = useCallback(async () => {
    if (!isDecant) return
    setStockStatus("loading")
    try {
      const { availability, max_quantity } = await getDecantAvailability(
        product.id,
      )
      setDecantAvailability(availability)
      setDecantMaxQuantity(max_quantity)
      setStockStatus("ready")
    } catch {
      setDecantAvailability({})
      setDecantMaxQuantity({})
      setStockStatus("error")
    }
  }, [isDecant, product.id])

  useEffect(() => {
    void refreshDecantAvailability()
  }, [refreshDecantAvailability])

  const availableVariants = useMemo(
    () => getCustomerVariants(product),
    [product],
  )
  const productForPurchase = useMemo(
    () => ({ ...product, variants: availableVariants }),
    [product, availableVariants],
  )

  // Decants open with the smallest volume, unless the URL selects a variant.
  useEffect(() => {
    if (!availableVariants.length || Object.keys(options).length > 0) return
    if (!isDecant && availableVariants.length !== 1) return

    const fromUrl = availableVariants.find(
      (variant) => variant.id === searchParams.get("v_id"),
    )
    const smallest = [...availableVariants].sort((a, b) => {
      const volume = (variant: HttpTypes.StoreProductVariant) => {
        const stored = Number(variant.metadata?.volume_ml)
        if (Number.isFinite(stored) && stored > 0) return stored
        const value = variant.options?.[0]?.value || variant.title || ""
        return Number(
          value.match(/^\s*(\d+(?:[.,]\d+)?)/)?.[1].replace(",", ".") ??
            Infinity,
        )
      }
      return volume(a) - volume(b)
    })[0]
    setOptions(optionsAsKeymap((fromUrl || smallest).options) ?? {})
  }, [availableVariants, isDecant, options, searchParams])

  const selectedVariant = useMemo(() => {
    if (!availableVariants.length) {
      return
    }

    return availableVariants.find((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [availableVariants, options])

  // update the options when a variant is selected
  const setOptionValue = (optionId: string, value: string) => {
    setAddError("")
    setOptions((prev) => ({
      ...prev,
      [optionId]: value,
    }))
  }

  //check if the selected options produce a valid variant
  const isValidVariant = useMemo(() => {
    return availableVariants.some((v) => {
      const variantOptions = optionsAsKeymap(v.options)
      return isEqual(variantOptions, options)
    })
  }, [availableVariants, options])

  useEffect(() => {
    if (Object.keys(options).length === 0 && (!selectedVariant || isDecant))
      return
    const params = new URLSearchParams(searchParams.toString())
    const value = isValidVariant ? selectedVariant?.id : null

    if (params.get("v_id") === value) {
      return
    }

    if (value) {
      params.set("v_id", value)
    } else {
      params.delete("v_id")
    }

    router.replace(pathname + "?" + params.toString(), { scroll: false })
  }, [
    isDecant,
    isValidVariant,
    options,
    pathname,
    router,
    searchParams,
    selectedVariant,
  ])

  // check if the selected variant is in stock
  const inStock = useMemo(() => {
    if (isDecant) {
      return (
        !!selectedVariant &&
        stockStatus === "ready" &&
        decantAvailability[selectedVariant.id] === true
      )
    }
    // If we don't manage inventory, we can always add to cart
    if (selectedVariant && !selectedVariant.manage_inventory) {
      return true
    }

    // If we allow back orders on the variant, we can add to cart
    if (selectedVariant?.allow_backorder) {
      return true
    }

    // If there is inventory available, we can add to cart
    if (
      selectedVariant?.manage_inventory &&
      (selectedVariant?.inventory_quantity || 0) > 0
    ) {
      return true
    }

    // Otherwise, we can't add to cart
    return false
  }, [selectedVariant, isDecant, stockStatus, decantAvailability])

  const quantityValue = Number(quantity)
  const validQuantity = Number.isInteger(quantityValue) && quantityValue > 0
  const maxQuantity = isDecant
    ? selectedVariant
      ? (decantMaxQuantity[selectedVariant.id] ?? 0)
      : 0
    : selectedVariant?.manage_inventory && !selectedVariant.allow_backorder
      ? Math.max(0, selectedVariant.inventory_quantity || 0)
      : null
  const exceedsStock =
    maxQuantity !== null && maxQuantity > 0 && quantityValue > maxQuantity

  useEffect(() => {
    if (!selectedVariant || !inStock) {
      setQuantity("0")
      return
    }
    setQuantity((current) => {
      const currentQuantity = Number(current)
      const nextQuantity =
        Number.isInteger(currentQuantity) && currentQuantity > 0
          ? currentQuantity
          : 1
      return String(
        maxQuantity !== null && maxQuantity > 0
          ? Math.min(nextQuantity, maxQuantity)
          : nextQuantity,
      )
    })
  }, [inStock, maxQuantity, selectedVariant])

  const unavailableVariantIds = useMemo(
    () =>
      isDecant && stockStatus === "ready"
        ? availableVariants
            .filter((variant) => decantAvailability[variant.id] === false)
            .map((variant) => variant.id)
        : [],
    [isDecant, stockStatus, availableVariants, decantAvailability],
  )

  const actionsRef = useRef<HTMLDivElement>(null)

  const inView = useIntersection(actionsRef, "0px")

  // add the selected variant to the cart
  const handleAddToCart = async () => {
    if (!selectedVariant?.id || !validQuantity || exceedsStock) return null

    setIsAdding(true)
    setAddError("")
    try {
      await addToCart({
        variantId: selectedVariant.id,
        quantity: quantityValue,
        countryCode,
      })
      router.refresh()
      setQuantity("1")
      await refreshDecantAvailability()
    } catch (error) {
      const message = error instanceof Error ? error.message : ""
      setAddError(
        /наличност|stock|достатъчно/i.test(message)
          ? isDecant
            ? "Няма достатъчно от този парфюм за избраните отливки и останалото в кошницата."
            : "Няма достатъчно налични бутилки от този парфюм за избраното количество."
          : message || "Артикулът не можа да се добави в кошницата.",
      )
      await refreshDecantAvailability()
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-y-2" ref={actionsRef}>
        <div>
          {availableVariants.length > 1 && (
            <div className="flex flex-col gap-y-4">
              {(product.options || []).map((option) => {
                return (
                  <div key={option.id}>
                    <OptionSelect
                      option={option}
                      current={options[option.id]}
                      updateOption={setOptionValue}
                      title={option.title ?? ""}
                      data-testid="product-options"
                      disabled={!!disabled || isAdding}
                      allowedValues={availableVariants.flatMap((variant) =>
                        (variant.options || [])
                          .filter((entry) => entry.option_id === option.id)
                          .map((entry) => entry.value),
                      )}
                      unavailableValues={availableVariants
                        .filter((variant) =>
                          unavailableVariantIds.includes(variant.id),
                        )
                        .flatMap((variant) =>
                          (variant.options || [])
                            .filter((entry) => entry.option_id === option.id)
                            .map((entry) => entry.value),
                        )}
                    />
                  </div>
                )
              })}
              <Divider />
            </div>
          )}
        </div>

        {isDecant && stockStatus === "loading" ? (
          <p className="py-2 text-sm text-[#806e60]">
            Проверка на наличността…
          </p>
        ) : (
          <ProductPrice
            product={productForPurchase}
            variant={selectedVariant}
            unavailable={!inStock}
            unavailableMessage={
              isDecant && stockStatus === "error"
                ? "Наличността е недостъпна"
                : "Изчерпан"
            }
          />
        )}

        <div className="py-2">
          <QuantitySelector
            value={quantity}
            onChange={(value) => {
              setQuantity(value)
              setAddError("")
            }}
            maxQuantity={maxQuantity}
            disabled={!!disabled || isAdding || !selectedVariant || !inStock}
            message={
              addError ||
              (exceedsStock
                ? isDecant
                  ? "За тази отливка няма достатъчно наличност."
                  : "За този парфюм няма достатъчно наличност."
                : undefined)
            }
          />
        </div>

        <Button
          onClick={handleAddToCart}
          disabled={
            !inStock ||
            !selectedVariant ||
            !!disabled ||
            isAdding ||
            !isValidVariant ||
            !validQuantity ||
            exceedsStock
          }
          variant="primary"
          className="w-full h-10"
          isLoading={isAdding}
          data-testid="add-product-button"
        >
          {!selectedVariant
            ? "Изберете разфасовка"
            : isDecant && stockStatus === "loading"
              ? "Проверка на наличността…"
              : isDecant && stockStatus === "error"
                ? "Наличността е недостъпна"
                : !inStock || !isValidVariant
                  ? "Изчерпан"
                  : "Добави в кошницата"}
        </Button>
        {isDecant && stockStatus === "error" && (
          <button
            type="button"
            onClick={() => void refreshDecantAvailability()}
            className="self-start text-sm underline"
          >
            Опитай отново
          </button>
        )}
        <MobileActions
          product={productForPurchase}
          variant={selectedVariant}
          options={options}
          updateOptions={setOptionValue}
          inStock={inStock}
          stockLoading={isDecant && stockStatus === "loading"}
          stockError={isDecant && stockStatus === "error"}
          unavailableVariantIds={unavailableVariantIds}
          handleAddToCart={handleAddToCart}
          isAdding={isAdding}
          show={!inView}
          optionsDisabled={!!disabled || isAdding}
          quantity={quantity}
          updateQuantity={(value) => {
            setQuantity(value)
            setAddError("")
          }}
          maxQuantity={maxQuantity}
          quantityValid={validQuantity && !exceedsStock}
          quantityMessage={addError}
        />
      </div>
    </>
  )
}
