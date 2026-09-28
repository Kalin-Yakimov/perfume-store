import { clx } from "@modules/common/components/ui"

import { getProductPrice } from "@lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"

export default function ProductPrice({
  product,
  variant,
  unavailable = false,
  unavailableMessage = "Изчерпан",
}: {
  product: HttpTypes.StoreProduct
  variant?: HttpTypes.StoreProductVariant
  unavailable?: boolean
  unavailableMessage?: string
}) {
  const { cheapestPrice, variantPrice } = getProductPrice({
    product,
    variantId: variant?.id,
  })

  const selectedPrice = variant ? variantPrice : cheapestPrice
  const displayVariant = variant || product.variants?.[0]
  const variantText = `${displayVariant?.title || ""} ${displayVariant?.sku || ""} ${
    displayVariant?.options?.map((option) => option.value).join(" ") || ""
  }`
  const volumeMatch = variantText.match(/(\d+(?:[.,]\d+)?)\s*ml/i)
  const storedVolume = Number(displayVariant?.metadata?.volume_ml)
  const volume = Number.isFinite(storedVolume) && storedVolume > 0
    ? `${storedVolume} мл`
    : volumeMatch ? `${volumeMatch[1]} мл` : ""

  if (!selectedPrice) {
    return <div className="block w-32 h-9 bg-gray-100 animate-pulse" />
  }

  return (
    <div className="flex items-start justify-between gap-4 text-ui-fg-base">
      <span className="text-xl-semi text-[#302a25]">
        {volume || "Разфасовка"}
      </span>
      <div className="text-right">
        {unavailable ? (
          <span className="text-sm font-semibold uppercase tracking-[0.1em] text-[#817a73]">
            {unavailableMessage}
          </span>
        ) : (
          <>
            <span
              className={clx("text-xl-semi", {
                "text-ui-fg-interactive": selectedPrice.price_type === "sale",
              })}
            >
              {!variant && "От "}
              <span
                data-testid="product-price"
                data-value={selectedPrice.calculated_price_number}
              >
                {selectedPrice.calculated_price}
              </span>
            </span>
            {selectedPrice.price_type === "sale" && (
              <>
                <p>
                  <span className="text-ui-fg-subtle">Оригинална цена: </span>
                  <span
                    className="line-through"
                    data-testid="original-product-price"
                    data-value={selectedPrice.original_price_number}
                  >
                    {selectedPrice.original_price}
                  </span>
                </p>
                <span className="text-ui-fg-interactive">
                  -{selectedPrice.percentage_diff}%
                </span>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
