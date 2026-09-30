import { redirect } from "next/navigation"

export default async function TransferPage({
  params,
}: {
  params: { countryCode: string; id: string; token: string }
}) {
  const { countryCode, id, token } = params

  // Avoid mutating an order when a browser or mail security scanner performs
  // a GET request. The customer must confirm the action explicitly.
  redirect(
    `/${encodeURIComponent(countryCode)}/order/${encodeURIComponent(id)}/transfer/${encodeURIComponent(token)}`,
  )
}
