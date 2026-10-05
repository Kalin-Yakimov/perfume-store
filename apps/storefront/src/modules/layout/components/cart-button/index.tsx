import { retrieveCartForRender } from "@lib/data/cart-read"
import CartDropdown from "../cart-dropdown"

export default async function CartButton() {
  const cart = await retrieveCartForRender().catch(() => null)

  return <CartDropdown cart={cart} />
}
