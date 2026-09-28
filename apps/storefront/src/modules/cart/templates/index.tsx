import ItemsTemplate from "./items"
import Summary from "./summary"
import EmptyCartMessage from "../components/empty-cart-message"
import SignInPrompt from "../components/sign-in-prompt"
import Divider from "@modules/common/components/divider"
import { HttpTypes } from "@medusajs/types"

const CartTemplate = ({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
}) => {
  return (
    <div className="flex flex-1 flex-col bg-[#fbf9f6]">
      <section className="border-b border-[#ded7cf] bg-[#eee8df] py-7 small:py-8">
        <div className="content-container max-w-6xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#826c5a]">
            Вашата селекция
          </p>
          <h1 className="font-display mt-1 text-3xl tracking-[-0.02em] small:text-4xl">
            Кошница
          </h1>
        </div>
      </section>
      <div
        className="content-container flex w-full max-w-6xl flex-1 flex-col py-8 small:py-12"
        data-testid="cart-container"
      >
        {cart?.items?.length ? (
          <div className="grid grid-cols-1 gap-10 small:grid-cols-[minmax(0,1fr)_340px] small:gap-14">
            <div className="flex min-w-0 flex-col gap-y-6">
              {!customer && (
                <>
                  <SignInPrompt />
                  <Divider className="border-[#ded7cf]" />
                </>
              )}
              <ItemsTemplate cart={cart} />
            </div>
            <aside className="relative border-t border-[#ded7cf] pt-6 small:border-l small:border-t-0 small:pl-8 small:pt-0">
              <div className="flex flex-col gap-y-8 small:sticky small:top-12">
                {cart && cart.region && <Summary cart={cart} />}
              </div>
            </aside>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center py-6">
            <EmptyCartMessage />
          </div>
        )}
      </div>
    </div>
  )
}

export default CartTemplate
