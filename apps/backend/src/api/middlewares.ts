import {
  defineMiddlewares,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { ValidateDecantStockBodySchema } from "./store/decant-stock/validate/middlewares"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/decant-stock/validate",
      method: "POST",
      middlewares: [validateAndTransformBody(ValidateDecantStockBodySchema)],
    },
  ],
})
