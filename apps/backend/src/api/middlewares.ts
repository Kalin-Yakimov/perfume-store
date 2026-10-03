import {
  defineMiddlewares,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { ValidateDecantStockBodySchema } from "./store/decant-stock/validate/middlewares"
import { catalogMiddlewares } from "./store/catalog/middlewares"
import { CreateFullPerfumeBodySchema, UpdateFullPerfumeBodySchema, UpdatePerfumeProfileBodySchema, UpdateDecantSettingsBodySchema } from "./admin/products/validators"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/full-perfumes",
      method: "POST",
      middlewares: [validateAndTransformBody(CreateFullPerfumeBodySchema)],
    },
    {
      matcher: "/admin/full-perfumes/:id",
      method: "PATCH",
      middlewares: [validateAndTransformBody(UpdateFullPerfumeBodySchema)],
    },
    {
      matcher: "/admin/products/:id/perfume-profile",
      method: "POST",
      middlewares: [validateAndTransformBody(UpdatePerfumeProfileBodySchema)],
    },
    {
      matcher: "/admin/products/:id/decants",
      method: "POST",
      middlewares: [validateAndTransformBody(UpdateDecantSettingsBodySchema)],
    },
    {
      matcher: "/store/catalog",
      method: "GET",
      middlewares: catalogMiddlewares,
    },
    {
      matcher: "/store/decant-stock/validate",
      method: "POST",
      middlewares: [validateAndTransformBody(ValidateDecantStockBodySchema)],
    },
  ],
})
