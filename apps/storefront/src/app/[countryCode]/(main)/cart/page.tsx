import { retrieveCartForRender } from "@lib/data/cart-read"
import { retrieveCustomer } from "@lib/data/customer"
import CartTemplate from "@modules/cart/templates"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Кошница",
  description: "Прегледайте избраните от вас парфюми и отливки.",
  robots: { index: false, follow: false },
}

export default async function Cart() {
  const [cart, customer] = await Promise.all([
    retrieveCartForRender(),
    retrieveCustomer(),
  ])

  return <CartTemplate cart={cart} customer={customer} />
}
