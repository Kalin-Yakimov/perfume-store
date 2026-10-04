import { clx } from "@modules/common/components/ui"

import { getProductPrice } from "@lib/util/get-product-price"
import {
  getCheapestCustomerVariant,
  getCustomerVariants,
  getVariantVolumeLabel,
} from "@lib/util/customer-variants"
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
  const displayVariant =
    variant ||
    getCheapestCustomerVariant(product) ||
    getCustomerVariants(product)[0]
  const volume = getVariantVolumeLabel(product, displayVariant)

  if (!selectedPrice && !unavailable) {
    return (
      <p className="text-sm text-[#817a73]">
        Не е зададена цена за тази разфасовка.
      </p>
    )
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
        ) : selectedPrice ? (
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
        ) : null}
      </div>
    </div>
  )
}
