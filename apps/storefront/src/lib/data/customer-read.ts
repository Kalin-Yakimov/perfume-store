import "server-only"

import { cache } from "react"
import { sdk } from "@lib/config"
import { getAuthHeaders } from "./cookies"
import type { CustomerProfile, CustomerSummary } from "./customer-types"

// React cache shares reads only during one server render. The authorization
// value and projection are primitive keys, so a changed session or a different
// projection cannot reuse another customer's result even within that render.
const readCustomer = cache(
  async <T extends CustomerSummary>(
    authorization: string,
    fields: string,
  ): Promise<T | null> => {
    return sdk.client
      .fetch<{ customer: T }>("/store/customers/me", {
        method: "GET",
        query: { fields },
        headers: { authorization },
        // The built-in SDK retrieve method cannot accept fetch cache options.
        // Private records must stay out of Next.js' shared data cache.
        cache: "no-store",
      })
      .then(({ customer }) => customer)
      .catch(() => null)
  },
)

export async function retrieveCustomerSummary(): Promise<CustomerSummary | null> {
  const { authorization } = await getAuthHeaders()
  if (!authorization) return null

  return readCustomer<CustomerSummary>(authorization, "id,email,first_name")
}

export async function retrieveCustomer(): Promise<CustomerProfile | null> {
  const { authorization } = await getAuthHeaders()
  if (!authorization) return null

  return readCustomer<CustomerProfile>(
    authorization,
    "id,email,first_name,last_name,phone,*addresses",
  )
}
