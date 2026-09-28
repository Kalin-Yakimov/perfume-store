"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  removeCartId,
  setCartId,
} from "./cookies"
import { getRegion } from "./regions"
import { getLocale } from "./locale-actions"
import { listCartShippingMethods } from "./fulfillment"
import {
  DeliveryPoint,
  getDeliveryCarrier,
  needsDeliveryPoint,
  readDeliveryPoint,
} from "@lib/util/delivery-point"

/**
 * Retrieves a cart by its ID. If no ID is provided, it will use the cart ID from the cookies.
 * @param cartId - optional - The ID of the cart to retrieve.
 * @returns The cart object if found, or null if not found.
 */
export async function retrieveCart(cartId?: string, fields?: string) {
  const id = cartId || (await getCartId())
  fields ??=
    "*items, *region, *items.product, *items.variant, *items.thumbnail, *items.metadata, +items.total, *promotions, +shipping_methods.name, +metadata"

  if (!id) {
    return null
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("carts")),
  }

  return await sdk.client
    .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${id}`, {
      method: "GET",
      query: {
        fields,
      },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ cart }: { cart: HttpTypes.StoreCart }) => cart)
    .catch(() => null)
}

export async function getOrSetCart(countryCode: string) {
  const region = await getRegion(countryCode)

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  let cart = await retrieveCart(undefined, "id,region_id")

  const headers = {
    ...(await getAuthHeaders()),
  }

  if (!cart) {
    const locale = await getLocale()
    const cartResp = await sdk.store.cart.create(
      { region_id: region.id, locale: locale || undefined },
      {},
      headers,
    )
    cart = cartResp.cart

    await setCartId(cart.id)

    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
  }

  if (cart && cart?.region_id !== region.id) {
    await sdk.store.cart.update(cart.id, { region_id: region.id }, {}, headers)
    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
  }

  return cart
}

export async function updateCart(data: HttpTypes.StoreUpdateCart) {
  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("No existing cart found, please create one before updating")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .update(cartId, data, {}, headers)
    .then(async ({ cart }: { cart: HttpTypes.StoreCart }) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)

      return cart
    })
    .catch(medusaError)
}

export async function addToCart({
  variantId,
  quantity,
  countryCode,
}: {
  variantId: string
  quantity: number
  countryCode: string
}) {
  if (!variantId) {
    throw new Error("Missing variant ID when adding to cart")
  }

  const cart = await getOrSetCart(countryCode)

  if (!cart) {
    throw new Error("Error retrieving or creating cart")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.client.fetch(`/store/decant-stock/validate`, {
    method: "POST",
    body: { cart_id: cart.id, variant_id: variantId, quantity },
    headers,
  })

  await sdk.store.cart
    .createLineItem(
      cart.id,
      {
        variant_id: variantId,
        quantity,
      },
      {},
      headers,
    )
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function updateLineItem({
  lineId,
  quantity,
}: {
  lineId: string
  quantity: number
}) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when updating line item")
  }

  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("Missing cart ID when updating line item")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.client.fetch(`/store/decant-stock/validate`, {
    method: "POST",
    body: {
      cart_id: cartId,
      line_item_id: lineId,
      variant_id: "update",
      quantity,
    },
    headers,
  })

  await sdk.store.cart
    .updateLineItem(cartId, lineId, { quantity }, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

/** Maximum quantity for one cart row, considering the rest of the cart. */
export async function getCartLineItemQuantityLimit(
  lineId: string,
): Promise<number | null> {
  const cart = await retrieveCart(undefined, "id,*items")
  const line = cart?.items?.find((item) => item.id === lineId)
  if (!cart || !line?.product_id || !line.variant_id) {
    throw new Error("Артикулът вече не е наличен в кошницата.")
  }

  const headers = { ...(await getAuthHeaders()) }
  const { product } = await sdk.client.fetch<HttpTypes.StoreProductResponse>(
    `/store/products/${line.product_id}`,
    {
      query: { fields: "id,+metadata,*variants,+variants.inventory_quantity" },
      headers,
      cache: "no-store",
    },
  )
  const variant = product.variants?.find(
    (entry) => entry.id === line.variant_id,
  )
  if (!variant) throw new Error("Разфасовката вече не е налична.")

  if (product.metadata?.listing_type === "decant") {
    const response = await sdk.client.fetch<{
      max_quantity: Record<string, number>
    }>("/store/decant-stock/availability", {
      query: { product_id: product.id, cart_id: cart.id },
      headers,
      cache: "no-store",
    })
    return line.quantity + Math.max(0, response.max_quantity[variant.id] ?? 0)
  }

  if (!variant.manage_inventory || variant.allow_backorder) return null
  if (typeof variant.inventory_quantity !== "number") {
    throw new Error("Наличността временно не може да бъде проверена.")
  }
  const quantityInOtherRows = (cart.items || []).reduce(
    (total, item) =>
      total +
      (item.id !== lineId && item.variant_id === variant.id
        ? item.quantity
        : 0),
    0,
  )
  const inventoryLimit = Math.max(
    0,
    variant.inventory_quantity - quantityInOtherRows,
  )
  if (inventoryLimit <= line.quantity) return inventoryLimit

  // Whole bottles and decants in the same cart draw from the same stock.
  // Validate the upper bound first; search only if that combination cannot fit.
  const canUseQuantity = async (quantity: number) => {
    try {
      await sdk.client.fetch("/store/decant-stock/validate", {
        method: "POST",
        body: {
          cart_id: cart.id,
          line_item_id: lineId,
          variant_id: variant.id,
          quantity,
        },
        headers,
        cache: "no-store",
      })
      return true
    } catch (cause) {
      if (
        (cause as { response?: { status?: number } }).response?.status === 409
      ) {
        return false
      }
      throw cause
    }
  }
  if (await canUseQuantity(inventoryLimit)) return inventoryLimit

  let low = 0
  let high = inventoryLimit - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (await canUseQuantity(middle)) low = middle
    else high = middle - 1
  }
  return low
}

export async function deleteLineItem(lineId: string) {
  if (!lineId) {
    throw new Error("Missing lineItem ID when deleting line item")
  }

  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("Missing cart ID when deleting line item")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.cart
    .deleteLineItem(cartId, lineId, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function setShippingMethod({
  cartId,
  shippingMethodId,
}: {
  cartId: string
  shippingMethodId: string
}) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .addShippingMethod(cartId, { option_id: shippingMethodId }, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
    })
    .catch(medusaError)
}

export async function setDeliveryChoice({
  shippingMethodId,
  point,
}: {
  shippingMethodId: string
  point: DeliveryPoint | null
}) {
  const cart = await retrieveCart()
  if (!cart) throw new Error("Кошницата не беше намерена.")

  const options = await listCartShippingMethods(cart.id)
  const option = options?.find((item) => item.id === shippingMethodId)
  if (!option) throw new Error("Този начин на доставка вече не е наличен.")

  if (needsDeliveryPoint(option.name)) {
    const carrier = getDeliveryCarrier(option.name)
    if (
      !point ||
      point.shippingOptionId !== shippingMethodId ||
      point.carrier !== carrier ||
      !point.id.trim() ||
      !point.address.trim() ||
      !point.city.trim()
    ) {
      throw new Error("Моля, изберете обект и потвърдете населеното място.")
    }
  }

  await setShippingMethod({ cartId: cart.id, shippingMethodId })
  await updateCart({
    metadata: {
      ...(cart.metadata || {}),
      delivery_point: needsDeliveryPoint(option.name) ? point : null,
    },
  })
}

export async function initiatePaymentSession(
  cart: HttpTypes.StoreCart,
  data: HttpTypes.StoreInitializePaymentSession,
) {
  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.payment
    .initiatePaymentSession(cart, data, {}, headers)
    .then(async (resp) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
      return resp
    })
    .catch(medusaError)
}

export async function applyPromotions(codes: string[]) {
  const cartId = await getCartId()

  if (!cartId) {
    throw new Error("No existing cart found")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.cart
    .update(cartId, { promo_codes: codes }, {}, headers)
    .then(async () => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)

      const fulfillmentCacheTag = await getCacheTag("fulfillment")
      revalidateTag(fulfillmentCacheTag)
    })
    .catch(medusaError)
}

export async function applyGiftCard(code: string) {
  //   const cartId = getCartId()
  //   if (!cartId) return "No cartId cookie found"
  //   try {
  //     await updateCart(cartId, { gift_cards: [{ code }] }).then(() => {
  //       revalidateTag("cart")
  //     })
  //   } catch (error: any) {
  //     throw error
  //   }
}

export async function removeDiscount(code: string) {
  // const cartId = getCartId()
  // if (!cartId) return "No cartId cookie found"
  // try {
  //   await deleteDiscount(cartId, code)
  //   revalidateTag("cart")
  // } catch (error: any) {
  //   throw error
  // }
}

export async function removeGiftCard(
  codeToRemove: string,
  giftCards: any[],
  // giftCards: GiftCard[]
) {
  //   const cartId = getCartId()
  //   if (!cartId) return "No cartId cookie found"
  //   try {
  //     await updateCart(cartId, {
  //       gift_cards: [...giftCards]
  //         .filter((gc) => gc.code !== codeToRemove)
  //         .map((gc) => ({ code: gc.code })),
  //     }).then(() => {
  //       revalidateTag("cart")
  //     })
  //   } catch (error: any) {
  //     throw error
  //   }
}

export async function submitPromotionForm(
  currentState: unknown,
  formData: FormData,
) {
  const code = formData.get("code") as string
  try {
    await applyPromotions([code])
  } catch (e: any) {
    return e.message
  }
}

export async function setAddresses(currentState: unknown, formData: FormData) {
  try {
    const cart = await retrieveCart()
    if (!cart) throw new Error("Кошницата не беше намерена.")
    const name = String(
      formData.get("shipping_address.first_name") || "",
    ).trim()
    const surname = String(
      formData.get("shipping_address.last_name") || "",
    ).trim()
    const email = String(formData.get("email") || "").trim()
    const phone = String(formData.get("shipping_address.phone") || "").trim()
    if (!name || !surname || !email || !phone) {
      throw new Error("Попълнете име, фамилия, имейл и телефон.")
    }

    const optionId = cart.shipping_methods?.at(-1)?.shipping_option_id
    const options = await listCartShippingMethods(cart.id)
    const option = options?.find((item) => item.id === optionId)
    if (!option) throw new Error("Изберете начин на доставка.")
    const selectedPoint = readDeliveryPoint(cart.metadata?.delivery_point)
    const needsPoint = needsDeliveryPoint(option.name)
    if (needsPoint && selectedPoint?.shippingOptionId !== optionId) {
      throw new Error("Изберете обект за получаване на поръчката.")
    }

    const address = needsPoint
      ? selectedPoint!.address
      : String(formData.get("shipping_address.address_1") || "").trim()
    const city = needsPoint
      ? selectedPoint!.city
      : String(formData.get("shipping_address.city") || "").trim()
    if (!address || !city) throw new Error("Попълнете адрес и населено място.")

    const shippingAddress = {
      first_name: name,
      last_name: surname,
      address_1: needsPoint
        ? `${selectedPoint!.name} (${selectedPoint!.id}), ${address}`
        : address,
      city,
      postal_code: needsPoint
        ? selectedPoint!.postalCode || ""
        : String(formData.get("shipping_address.postal_code") || "").trim(),
      country_code: "bg",
      phone,
    }
    await updateCart({
      email,
      shipping_address: shippingAddress,
      billing_address: shippingAddress,
    })
  } catch (cause) {
    return cause instanceof Error
      ? cause.message
      : "Данните не можаха да се запазят."
  }

  redirect("/zavarshvane-na-porachka?step=review")
}

/**
 * Places an order for a cart. If no cart ID is provided, it will use the cart ID from the cookies.
 * @param cartId - optional - The ID of the cart to place an order for.
 * @returns The cart object if the order was successful, or null if not.
 */
export async function placeOrder(cartId?: string) {
  const id = cartId || (await getCartId())

  if (!id) {
    throw new Error("No existing cart found when placing an order")
  }

  const cart = await retrieveCart(id)
  if (!cart || cart.shipping_address?.country_code !== "bg") {
    throw new Error("Поръчки могат да се доставят само в България.")
  }
  const shippingMethod = cart.shipping_methods?.at(-1)
  if (!shippingMethod) throw new Error("Изберете начин на доставка.")
  const options = await listCartShippingMethods(id)
  const option = options?.find(
    (item) => item.id === shippingMethod.shipping_option_id,
  )
  if (!option) throw new Error("Избраният начин на доставка не е наличен.")
  const point = readDeliveryPoint(cart.metadata?.delivery_point)
  if (
    needsDeliveryPoint(option.name) &&
    point?.shippingOptionId !== option.id
  ) {
    throw new Error("Изберете обект за получаване.")
  }
  const optionName = option.name.toLocaleLowerCase("bg-BG")
  const isLocker =
    optionName.includes("автомат") ||
    optionName.includes("boxnow") ||
    optionName.includes("box now")
  const paymentSession = cart.payment_collection?.payment_sessions?.find(
    (session) => session.status === "pending",
  )
  if (isLocker && paymentSession?.provider_id === "pp_system_default") {
    throw new Error("За автомат изберете онлайн плащане.")
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const cartRes = await sdk.store.cart
    .complete(id, {}, headers)
    .then(async (cartRes) => {
      const cartCacheTag = await getCacheTag("carts")
      revalidateTag(cartCacheTag)
      return cartRes
    })
    .catch(medusaError)

  if (cartRes?.type === "order") {
    const countryCode =
      cartRes.order.shipping_address?.country_code?.toLowerCase()

    const orderCacheTag = await getCacheTag("orders")
    revalidateTag(orderCacheTag)

    removeCartId()
    redirect(`/${countryCode}/order/${cartRes?.order.id}/confirmed`)
  }

  return cartRes.cart
}

/**
 * Updates the countrycode param and revalidates the regions cache
 * @param regionId
 * @param countryCode
 */
export async function updateRegion(countryCode: string, currentPath: string) {
  const cartId = await getCartId()
  const region = await getRegion(countryCode)

  if (!region) {
    throw new Error(`Region not found for country code: ${countryCode}`)
  }

  if (cartId) {
    await updateCart({ region_id: region.id })
    const cartCacheTag = await getCacheTag("carts")
    revalidateTag(cartCacheTag)
  }

  const regionCacheTag = await getCacheTag("regions")
  revalidateTag(regionCacheTag)

  const productsCacheTag = await getCacheTag("products")
  revalidateTag(productsCacheTag)

  redirect(`/${countryCode}${currentPath}`)
}

export async function listCartOptions() {
  const cartId = await getCartId()
  const headers = {
    ...(await getAuthHeaders()),
  }
  const next = {
    ...(await getCacheOptions("shippingOptions")),
  }

  return await sdk.client.fetch<{
    shipping_options: HttpTypes.StoreCartShippingOption[]
  }>("/store/shipping-options", {
    query: { cart_id: cartId },
    next,
    headers,
    cache: "force-cache",
  })
}
