"use client"

import { DeliveryPoint } from "@lib/util/delivery-point"
import { HttpTypes } from "@medusajs/types"
import Input from "@modules/common/components/input"
import { useEffect, useState } from "react"

export default function ShippingAddress({
  customer,
  cart,
  point,
}: {
  customer: HttpTypes.StoreCustomer | null
  cart: HttpTypes.StoreCart | null
  point: DeliveryPoint | null
}) {
  const [values, setValues] = useState({
    firstName: cart?.shipping_address?.first_name || customer?.first_name || "",
    lastName: cart?.shipping_address?.last_name || customer?.last_name || "",
    email: cart?.email || customer?.email || "",
    phone: cart?.shipping_address?.phone || customer?.phone || "",
    address: cart?.shipping_address?.address_1 || "",
    city: cart?.shipping_address?.city || "",
    postalCode: cart?.shipping_address?.postal_code || "",
  })

  useEffect(() => {
    setValues((current) => ({
      ...current,
      firstName: cart?.shipping_address?.first_name || current.firstName,
      lastName: cart?.shipping_address?.last_name || current.lastName,
      email: cart?.email || current.email,
      phone: cart?.shipping_address?.phone || current.phone,
    }))
  }, [
    cart?.email,
    cart?.shipping_address?.first_name,
    cart?.shipping_address?.last_name,
    cart?.shipping_address?.phone,
  ])

  const update =
    (key: keyof typeof values) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues((current) => ({ ...current, [key]: event.target.value }))

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xsmall:grid-cols-2">
        <Input
          label="Име"
          name="shipping_address.first_name"
          autoComplete="given-name"
          value={values.firstName}
          onChange={update("firstName")}
          required
          data-testid="shipping-first-name-input"
        />
        <Input
          label="Фамилия"
          name="shipping_address.last_name"
          autoComplete="family-name"
          value={values.lastName}
          onChange={update("lastName")}
          required
          data-testid="shipping-last-name-input"
        />
        <Input
          label="Имейл"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={update("email")}
          required
          data-testid="shipping-email-input"
        />
        <Input
          label="Телефон"
          name="shipping_address.phone"
          type="tel"
          autoComplete="tel"
          value={values.phone}
          onChange={update("phone")}
          required
          data-testid="shipping-phone-input"
        />
      </div>

      {point ? (
        <div className="border border-[#ded7cf] bg-[#f8f3ed] px-4 py-4 text-sm leading-6 text-[#62584f]">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#826c5a]">
            Избран обект за получаване
          </p>
          <p className="mt-1 font-semibold text-[#211d19]">{point.name}</p>
          <p>{point.address}</p>
          <p>{point.city}</p>
        </div>
      ) : (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[#211d19]">
            Адрес за доставка
          </h3>
          <div className="grid gap-4 xsmall:grid-cols-2">
            <div className="xsmall:col-span-2">
              <Input
                label="Улица и номер"
                name="shipping_address.address_1"
                autoComplete="address-line1"
                value={values.address}
                onChange={update("address")}
                required
                data-testid="shipping-address-input"
              />
            </div>
            <Input
              label="Населено място"
              name="shipping_address.city"
              autoComplete="address-level2"
              value={values.city}
              onChange={update("city")}
              required
              data-testid="shipping-city-input"
            />
            <Input
              label="Пощенски код (по желание)"
              name="shipping_address.postal_code"
              autoComplete="postal-code"
              value={values.postalCode}
              onChange={update("postalCode")}
              data-testid="shipping-postal-code-input"
            />
          </div>
        </div>
      )}
      <p className="text-xs leading-5 text-[#806e60]">
        Доставяме само в България. Данните се използват за обработка на
        поръчката.
      </p>
    </div>
  )
}
