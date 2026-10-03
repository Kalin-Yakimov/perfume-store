import type { HttpTypes } from "@medusajs/types"

export type RecentOrder = Pick<
  HttpTypes.StoreOrder,
  "id" | "display_id" | "created_at" | "total" | "currency_code"
>
