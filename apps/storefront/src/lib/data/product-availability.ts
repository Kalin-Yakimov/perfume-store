"use server"

import { HttpTypes } from "@medusajs/types"
import { isBottleAvailable } from "@lib/util/product-stock"
import { getDecantCatalogAvailability } from "./decant-stock"

/** Shared catalog state for catalogs, brands and perfume-note result pages. */
export async function getUnavailableProductIds(products: HttpTypes.StoreProduct[]) {
  const decantIds = products
    .filter((product) => product.metadata?.listing_type === "decant")
    .map((product) => product.id)
  const decantAvailability = await getDecantCatalogAvailability(decantIds)

  return products
    .filter((product) =>
      product.metadata?.listing_type === "decant"
        // During a stock API outage, product actions still validate availability.
        ? decantAvailability?.[product.id] === false
        : !isBottleAvailable(product),
    )
    .map((product) => product.id)
}
