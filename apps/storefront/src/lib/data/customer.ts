"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { FetchError } from "@medusajs/js-sdk"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  getPendingCustomer,
  getPendingVerificationToken,
  removeAuthToken,
  removeCartId,
  removePendingCustomer,
  removePendingVerificationToken,
  setAuthToken,
  setPendingCustomer,
  setPendingVerificationToken,
} from "./cookies"

export type CustomerAuthState =
  | { state: "error"; error: string }
  | { state: "verification_required"; email: string }
  | { state: "success" }
  | null

type CustomerAuthResponse = {
  token?: string
  verification_required?: boolean
  location?: string
}

// Requests a verification email for the given customer. The request must be
// authenticated with a token tied to the auth identity (the token returned by
// register or by a login that requires verification).
async function requestVerificationEmail(email: string, token: string) {
  await sdk.auth.verification.request(
    {
      entity_id: email,
      entity_type: "email",
    },
    {
      authorization: `Bearer ${token}`,
    },
  )
}

export const retrieveCustomer =
  async (): Promise<HttpTypes.StoreCustomer | null> => {
    const authHeaders = await getAuthHeaders()

    if (!authHeaders) return null

    const headers = {
      ...authHeaders,
    }

    const next = {
      ...(await getCacheOptions("customers")),
    }

    return await sdk.client
      .fetch<{ customer: HttpTypes.StoreCustomer }>(`/store/customers/me`, {
        method: "GET",
        query: {
          fields: "*orders",
        },
        headers,
        next,
        cache: "force-cache",
      })
      .then(({ customer }) => customer)
      .catch(() => null)
  }

export const updateCustomer = async (body: HttpTypes.StoreUpdateCustomer) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const updateRes = await sdk.store.customer
    .update(body, {}, headers)
    .then(({ customer }) => customer)
    .catch(medusaError)

  const cacheTag = await getCacheTag("customers")
  revalidateTag(cacheTag)

  return updateRes
}

export async function signup(
  _currentState: unknown,
  formData: FormData,
): Promise<CustomerAuthState> {
  const password = formData.get("password") as string
  const customerForm = {
    email: formData.get("email") as string,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    phone: formData.get("phone") as string,
  }

  let registrationToken: string | undefined

  try {
    registrationToken = await sdk.auth.register("customer", "emailpass", {
      email: customerForm.email,
      password,
    })
  } catch (error) {
    const fetchError = error as FetchError
    // An existing identity (for example, an admin user with the same email) is
    // expected and handled: the customer can still log in to link a customer
    // record. Any other error is surfaced.
    if (
      fetchError.statusText !== "Unauthorized" ||
      fetchError.message !== "Identity with email already exists"
    ) {
      return { state: "error", error: String(error) }
    }
  }

  // Persist the extra signup fields. The customer record is created during
  // login, which is deferred until after email verification when the backend
  // requires it.
  await setPendingCustomer(customerForm)

  // Continue by logging in. The login response tells us whether the backend
  // requires email verification — we don't need a storefront-side flag.
  return completeLogin(customerForm.email, password, registrationToken)
}

export async function login(
  _currentState: unknown,
  formData: FormData,
): Promise<CustomerAuthState> {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  return completeLogin(email, password)
}

// Logs the customer in and reconciles the customer record. The behavior is
// driven entirely by the backend's login response, so it works whether or not
// email verification is enabled.
async function completeLogin(
  email: string,
  password: string,
  registrationToken?: string,
): Promise<CustomerAuthState> {
  let result: CustomerAuthResponse

  try {
    result = await sdk.client.fetch<CustomerAuthResponse>(
      "/auth/customer/emailpass",
      {
        method: "POST",
        body: { email, password },
        headers: registrationToken
          ? { authorization: `Bearer ${registrationToken}` }
          : undefined,
      },
    )
  } catch (error) {
    return { state: "error", error: String(error) }
  }

  // A `location` is returned by third-party auth providers, which this flow
  // doesn't support.
  if (result.location) {
    return {
      state: "error",
      error: "This login method isn't supported by the storefront.",
    }
  }

  // The backend requires email verification and the customer hasn't verified
  // yet. Send the verification email and ask them to check their inbox.
  if (result.verification_required && result.token) {
    await setPendingVerificationToken(result.token)
    try {
      await requestVerificationEmail(email, result.token)
    } catch {
      // Ignore: the customer can resend from the verification page.
    }
    return { state: "verification_required", email }
  }

  if (!result.token) {
    return {
      state: "error",
      error: "Authentication requires additional steps that aren't supported.",
    }
  }

  let token = result.token

  // The token may not be tied to a customer record yet — right after
  // registration, or after verifying a brand-new account. Ask the backend:
  // `/store/customers/me` rejects tokens without a registered actor, so a
  // failed retrieve means we still need to create the customer, then log in
  // again to obtain a customer-bound token.
  const customerExists = await sdk.store.customer
    .retrieve({}, { authorization: `Bearer ${token}` })
    .then(() => true)
    .catch(() => false)

  if (!customerExists) {
    const pending = await getPendingCustomer()

    try {
      await sdk.store.customer.create(
        {
          email,
          first_name: pending?.first_name,
          last_name: pending?.last_name,
          phone: pending?.phone,
        },
        {},
        { authorization: `Bearer ${token}` },
      )

      const loginResponse = await sdk.client.fetch<CustomerAuthResponse>(
        "/auth/customer/emailpass",
        { method: "POST", body: { email, password } },
      )
      if (!loginResponse.token || loginResponse.verification_required) {
        return {
          state: "error",
          error:
            "Неуспешно активиране на профила. Моля, опитайте да влезете отново.",
        }
      }
      token = loginResponse.token
    } catch (error) {
      return { state: "error", error: String(error) }
    }

    await removePendingCustomer()
  }

  await setAuthToken(token)
  await removePendingVerificationToken()

  const customerCacheTag = await getCacheTag("customers")
  revalidateTag(customerCacheTag)

  try {
    await transferCart()
  } catch (error) {
    return { state: "error", error: String(error) }
  }

  return { state: "success" }
}

// Confirms a customer's email using the token from the verification link.
//
// The confirm route doesn't require authentication, so this works even when the
// customer opens the link on a different device than the one they signed up on.
export async function confirmEmailVerification(
  token: string,
): Promise<{ success: boolean; signedIn: boolean; error?: string }> {
  let verification: Awaited<ReturnType<typeof sdk.auth.verification.confirm>>
  try {
    verification = await sdk.auth.verification.confirm({ code: token })
  } catch (error) {
    return { success: false, signedIn: false, error: String(error) }
  }

  const identityToken = await getPendingVerificationToken()

  // Medusa's verification endpoint confirms the address but intentionally
  // does not create a customer session. A short-lived token from the
  // registration browser lets us safely complete sign-in there.
  if (!identityToken) {
    return { success: true, signedIn: false }
  }

  try {
    const refreshed = await sdk.client.fetch<CustomerAuthResponse>(
      "/auth/token/refresh",
      {
        method: "POST",
        headers: { authorization: `Bearer ${identityToken}` },
      },
    )

    if (!refreshed.token || refreshed.verification_required) {
      await removePendingVerificationToken()
      await removePendingCustomer()
      return { success: true, signedIn: false }
    }

    let customerToken = refreshed.token
    const customerExists = await sdk.store.customer
      .retrieve({}, { authorization: `Bearer ${customerToken}` })
      .then(() => true)
      .catch(() => false)

    if (!customerExists) {
      const pending = await getPendingCustomer()
      const email = verification.entity_id
      const matchingPending =
        pending?.email.trim().toLowerCase() === email.trim().toLowerCase()

      await sdk.store.customer.create(
        {
          email,
          first_name: matchingPending ? pending?.first_name : undefined,
          last_name: matchingPending ? pending?.last_name : undefined,
          phone: matchingPending ? pending?.phone : undefined,
        },
        {},
        { authorization: `Bearer ${customerToken}` },
      )

      const customerLogin = await sdk.client.fetch<CustomerAuthResponse>(
        "/auth/token/refresh",
        {
          method: "POST",
          headers: { authorization: `Bearer ${identityToken}` },
        },
      )

      if (!customerLogin.token || customerLogin.verification_required) {
        await removePendingVerificationToken()
        await removePendingCustomer()
        return { success: true, signedIn: false }
      }
      customerToken = customerLogin.token
    }

    await setAuthToken(customerToken)
    await removePendingVerificationToken()
    await removePendingCustomer()

    const customerCacheTag = await getCacheTag("customers")
    revalidateTag(customerCacheTag)

    try {
      await transferCart()
    } catch {
      // Email verification and sign-in succeeded; cart transfer is best effort.
    }

    return { success: true, signedIn: true }
  } catch (error) {
    await removePendingVerificationToken()
    await removePendingCustomer()
    return { success: true, signedIn: false, error: String(error) }
  }
}

export async function requestPasswordReset(
  _currentState: unknown,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase()

  if (!email) {
    return { success: false, error: "Въведете имейл адрес." }
  }

  try {
    await sdk.auth.resetPassword("customer", "emailpass", {
      identifier: email,
    })
    // Medusa deliberately returns success even when the email is unknown, to
    // avoid revealing which addresses have accounts.
    return { success: true }
  } catch {
    return {
      success: false,
      error: "Заявката не можа да бъде обработена. Опитайте отново след малко.",
    }
  }
}

export async function applyPasswordReset(
  token: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  if (!token || password.length < 8) {
    return {
      success: false,
      error: "Линкът е невалиден или паролата е по-кратка от 8 символа.",
    }
  }

  try {
    await sdk.auth.updateProvider("customer", "emailpass", { password }, token)
    return { success: true }
  } catch {
    return {
      success: false,
      error:
        "Линкът е изтекъл или невалиден. Поискайте нов линк за смяна на паролата.",
    }
  }
}

export async function signout(countryCode: string) {
  await sdk.auth.logout()

  await removeAuthToken()
  await removePendingVerificationToken()

  const customerCacheTag = await getCacheTag("customers")
  revalidateTag(customerCacheTag)

  await removeCartId()

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)

  redirect(`${countryCode === "bg" ? "" : `/${countryCode}`}/vhod`)
}

export async function transferCart() {
  const cartId = await getCartId()

  if (!cartId) {
    return
  }

  const headers = await getAuthHeaders()

  await sdk.store.cart.transferCart(cartId, {}, headers)

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)
}

export const addCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData,
): Promise<{ success: boolean; error: string | null }> => {
  const isDefaultBilling = (currentState.isDefaultBilling as boolean) || false
  const isDefaultShipping = (currentState.isDefaultShipping as boolean) || false

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
    phone: formData.get("phone") as string,
    is_default_billing: isDefaultBilling,
    is_default_shipping: isDefaultShipping,
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .createAddress(address, {}, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const deleteCustomerAddress = async (
  addressId: string,
): Promise<void> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.customer
    .deleteAddress(addressId, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const updateCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData,
): Promise<{ success: boolean; error: string | null }> => {
  const addressId =
    (currentState.addressId as string) || (formData.get("addressId") as string)

  if (!addressId) {
    return { success: false, error: "Address ID is required" }
  }

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
  } as HttpTypes.StoreUpdateCustomerAddress

  const phone = formData.get("phone") as string

  if (phone) {
    address.phone = phone
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .updateAddress(addressId, address, {}, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}
