import "server-only"
import { cookies as nextCookies } from "next/headers"

const cookieOptions = (sameSite: "lax" | "strict") => ({
  httpOnly: true,
  sameSite,
  secure: process.env.NODE_ENV === "production",
  path: "/",
})

const clearCookie = async (name: string, sameSite: "lax" | "strict") => {
  const cookies = await nextCookies()
  cookies.set(name, "", {
    ...cookieOptions(sameSite),
    maxAge: 0,
  })
}

export const getAuthHeaders = async (): Promise<
  { authorization: string } | Record<string, never>
> => {
  try {
    const cookies = await nextCookies()
    const token = cookies.get("_medusa_jwt")?.value

    if (!token) {
      return {}
    }

    return { authorization: `Bearer ${token}` }
  } catch {
    return {}
  }
}

// `sameSite: "lax"` rather than `"strict"`: the customer returns from a
// redirect-based payment method (iDEAL, Bancontact, ...) via a cross-site
// top-level navigation. A "strict" cookie is withheld on that navigation, so
// the storefront would see a logged-out, cartless visitor and render a 404 for
// the checkout page instead of resuming the order. "lax" is sent on top-level
// GET navigations while still blocking cross-site subrequests.
export const setAuthToken = async (token: string) => {
  const cookies = await nextCookies()
  cookies.set("_medusa_jwt", token, {
    maxAge: 60 * 60 * 24 * 7,
    ...cookieOptions("lax"),
  })
}

export const removeAuthToken = async () => {
  await clearCookie("_medusa_jwt", "lax")
}

export type PendingCustomer = {
  email: string
  first_name?: string
  last_name?: string
  phone?: string
}

// During the email verification flow the customer record isn't created until
// the customer verifies their email and logs in. We temporarily persist the
// extra signup fields in a cookie so they survive the customer leaving to open
// their inbox, and read them back when creating the customer at login.
export const setPendingCustomer = async (customer: PendingCustomer) => {
  const cookies = await nextCookies()
  cookies.set("_medusa_pending_customer", JSON.stringify(customer), {
    maxAge: 60 * 60 * 24,
    // The customer follows the verification link from their mail provider,
    // so this short-lived, non-authentication cookie must survive a top-level
    // cross-site navigation back to the storefront.
    ...cookieOptions("lax"),
  })
}

export const getPendingCustomer = async (): Promise<PendingCustomer | null> => {
  const cookies = await nextCookies()
  const value = cookies.get("_medusa_pending_customer")?.value

  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as PendingCustomer
  } catch {
    return null
  }
}

export const removePendingCustomer = async () => {
  await clearCookie("_medusa_pending_customer", "lax")
}

// Keep the short-lived, actorless registration token only in an httpOnly
// cookie so the verification link can finish sign-in in the same browser.
export const setPendingVerificationToken = async (token: string) => {
  const cookies = await nextCookies()
  cookies.set("_medusa_pending_verification", token, {
    maxAge: 60 * 60,
    ...cookieOptions("lax"),
  })
}

export const getPendingVerificationToken = async () => {
  const cookies = await nextCookies()
  return cookies.get("_medusa_pending_verification")?.value || null
}

export const removePendingVerificationToken = async () => {
  await clearCookie("_medusa_pending_verification", "lax")
}

export const getCartId = async () => {
  const cookies = await nextCookies()
  return cookies.get("_medusa_cart_id")?.value
}

// See the note on `setAuthToken`: `sameSite: "lax"` so the cart cookie survives
// the cross-site return navigation from a redirect-based payment method.
export const setCartId = async (cartId: string) => {
  const cookies = await nextCookies()
  cookies.set("_medusa_cart_id", cartId, {
    maxAge: 60 * 60 * 24 * 7,
    ...cookieOptions("lax"),
  })
}

export const removeCartId = async () => {
  await clearCookie("_medusa_cart_id", "lax")
}
