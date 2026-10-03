import type { HttpTypes } from "@medusajs/types"

export type CustomerSummary = Pick<
  HttpTypes.StoreCustomer,
  "id" | "email" | "first_name"
>

export type CustomerProfile = Pick<
  HttpTypes.StoreCustomer,
  "id" | "email" | "first_name" | "last_name" | "phone" | "addresses"
>
