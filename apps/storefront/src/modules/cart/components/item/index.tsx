"use client"

import { Table, Text, clx } from "@modules/common/components/ui"
import { getCartLineItemQuantityLimit, updateLineItem } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import ErrorMessage from "@modules/checkout/components/error-message"
import DeleteButton from "@modules/common/components/delete-button"
import LineItemOptions from "@modules/common/components/line-item-options"
import LineItemPrice from "@modules/common/components/line-item-price"
import LineItemUnitPrice from "@modules/common/components/line-item-unit-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Spinner from "@modules/common/icons/spinner"
import Thumbnail from "@modules/products/components/thumbnail"
import { useEffect, useState } from "react"
import { formatProductTitle } from "@lib/util/format-volume-for-display"
import { useRouter } from "next/navigation"

type ItemProps = {
  item: HttpTypes.StoreCartLineItem
  type?: "full" | "preview"
  currencyCode: string
}

const Item = ({ item, type = "full", currencyCode }: ItemProps) => {
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(item.quantity)
  const [limit, setLimit] = useState<number | null | undefined>(undefined)
  const router = useRouter()
  const title = formatProductTitle(
    item.product_title || item.title || "",
    item.product?.metadata?.listing_type === "decant",
  )

  useEffect(() => {
    if (type !== "full") return
    let active = true
    setQuantity(item.quantity)
    setLimit(undefined)
    getCartLineItemQuantityLimit(item.id)
      .then((value) => {
        if (active) setLimit(value)
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Наличността временно не може да бъде проверена.",
          )
      })
    return () => {
      active = false
    }
  }, [item.id, item.quantity, type])

  const changeQuantity = async (nextQuantity: number) => {
    if (
      nextQuantity < 1 ||
      updating ||
      (nextQuantity > quantity &&
        (limit === undefined || (limit !== null && nextQuantity > limit)))
    )
      return
    setError(null)
    setUpdating(true)

    try {
      await updateLineItem({ lineId: item.id, quantity: nextQuantity })
      setQuantity(nextQuantity)
      router.refresh()
      try {
        setLimit(await getCartLineItemQuantityLimit(item.id))
      } catch {
        setLimit(undefined)
        setError("Наличността временно не може да бъде проверена.")
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Количеството не можа да бъде променено.",
      )
      setLimit(undefined)
      getCartLineItemQuantityLimit(item.id)
        .then(setLimit)
        .catch(() => setLimit(undefined))
    } finally {
      setUpdating(false)
    }
  }

  return (
    <Table.Row
      className={clx("w-full", {
        "grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 py-4 small:table-row small:py-0": type === "full",
      })}
      data-testid="product-row"
    >
      <Table.Cell className={clx("!pl-0 p-4 w-24", {
        "row-span-2 !w-auto !p-0 small:!w-24 small:!py-4 small:!pr-4": type === "full",
      })}>
        <LocalizedClientLink
          href={`/products/${item.product_handle}`}
          className={clx("flex", {
            "w-16": type === "preview",
            "small:w-24 w-12": type === "full",
          })}
        >
          <Thumbnail
            thumbnail={item.thumbnail}
            images={item.variant?.product?.images}
            size="square"
            imageAlt={title}
          />
        </LocalizedClientLink>
      </Table.Cell>

      <Table.Cell className={clx("text-left", {
        "min-w-0 !p-0 small:!p-4": type === "full",
      })}>
        <Text
          className="txt-medium-plus text-ui-fg-base"
          data-testid="product-title"
        >
          {title}
        </Text>
        <LineItemOptions variant={item.variant} data-testid="product-variant" />
      </Table.Cell>

      {type === "full" && (
        <Table.Cell className="col-start-2 !px-0 !pb-0 !pt-3 small:!p-4">
          <div className="flex items-center gap-2">
            <DeleteButton id={item.id} data-testid="product-delete-button" />
            <div
              className="inline-flex h-9 items-center overflow-hidden rounded-md border border-[#cfc5ba] bg-white"
              data-testid="product-quantity-control"
            >
              <button
                type="button"
                aria-label="Намали количеството"
                onClick={() => void changeQuantity(quantity - 1)}
                disabled={updating || quantity <= 1}
                className="h-full w-8 text-lg text-[#302a25] transition hover:bg-[#f3eee8] disabled:cursor-not-allowed disabled:opacity-40"
              >
                −
              </button>
              <output
                aria-label="Брой продукти"
                aria-live="polite"
                className="flex h-full min-w-9 items-center justify-center border-x border-[#e4ddd5] px-1 text-sm font-semibold text-[#302a25]"
              >
                {quantity}
              </output>
              <button
                type="button"
                aria-label="Увеличи количеството"
                onClick={() => void changeQuantity(quantity + 1)}
                disabled={
                  updating ||
                  limit === undefined ||
                  (limit !== null && quantity >= limit)
                }
                className="h-full w-8 text-lg text-[#302a25] transition hover:bg-[#f3eee8] disabled:cursor-not-allowed disabled:opacity-40"
              >
                +
              </button>
            </div>
            {updating && <Spinner />}
          </div>
          <ErrorMessage error={error} data-testid="product-error-message" />
        </Table.Cell>
      )}

      {type === "full" && (
        <Table.Cell className="hidden small:table-cell">
          <LineItemUnitPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </Table.Cell>
      )}

      <Table.Cell className={clx("!pr-0", {
        "col-start-2 !px-0 !pb-0 !pt-3 small:!py-4 small:!pl-4": type === "full",
      })}>
        <span
          className={clx("!pr-0", {
            "flex flex-col items-end h-full justify-center": type === "preview",
          })}
        >
          {type === "preview" && (
            <span className="flex gap-x-1 ">
              <Text className="text-ui-fg-muted">{item.quantity}x </Text>
              <LineItemUnitPrice
                item={item}
                style="tight"
                currencyCode={currencyCode}
              />
            </span>
          )}
          <LineItemPrice
            item={item}
            style="tight"
            currencyCode={currencyCode}
          />
        </span>
      </Table.Cell>
    </Table.Row>
  )
}

export default Item
