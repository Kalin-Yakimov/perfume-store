import { redirect } from "next/navigation"

export default async function LegacyDecantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ countryCode }, query] = await Promise.all([params, searchParams])
  const queryString = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (Array.isArray(value))
      value.forEach((item) => queryString.append(key, item))
    else if (value) queryString.set(key, value)
  })
  const suffix = queryString.size ? `?${queryString.toString()}` : ""
  redirect(`/${countryCode}/otlivki${suffix}`)
}
