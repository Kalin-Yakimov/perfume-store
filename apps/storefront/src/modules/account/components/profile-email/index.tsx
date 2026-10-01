import { HttpTypes } from "@medusajs/types"

const ProfileEmail = ({ customer }: { customer: HttpTypes.StoreCustomer }) => (
  <div className="w-full" data-testid="account-email-editor">
    <p className="text-small-regular uppercase text-ui-fg-base">
      Имейл за вход
    </p>
    <p className="mt-1 break-all font-semibold">{customer.email}</p>
    <p className="mt-2 text-sm leading-6 text-ui-fg-subtle">
      Това е потвърденият адрес за вход във вашия профил. Засега не може да бъде
      променян оттук.
    </p>
  </div>
)

export default ProfileEmail
