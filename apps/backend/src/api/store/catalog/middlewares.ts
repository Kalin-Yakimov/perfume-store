import {
  authenticate,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import {
  filterByValidSalesChannels,
  normalizeDataForContext,
  setPricingContext,
  setTaxContext,
} from "@medusajs/medusa/api/utils/middlewares/index"
import { CatalogQuerySchema } from "./query-schema"

export const catalogMiddlewares = [
  authenticate("customer", ["session", "bearer"], {
    allowUnauthenticated: true,
  }),
  validateAndTransformQuery(CatalogQuerySchema, {
    isList: true,
    defaults: ["id", "variants.calculated_price"],
    defaultLimit: 40,
  }),
  filterByValidSalesChannels(),
  normalizeDataForContext(),
  setPricingContext(),
  setTaxContext(),
]
