import { redirect } from "next/navigation"

export default async function TransferPage({
  params,
}: {
  params: Promise<{ countryCode: string; id: string; token: string }>
}) {
  const { countryCode, id, token } = await params

  // A mail security scanner may open links automatically. Only the explicit
  // confirmation button on the transfer page may perform this mutation.
  redirect(
    `/${encodeURIComponent(countryCode)}/order/${encodeURIComponent(id)}/transfer/${encodeURIComponent(token)}`,
  )
}
