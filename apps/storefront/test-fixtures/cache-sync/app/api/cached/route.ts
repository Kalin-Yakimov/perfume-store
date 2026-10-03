import { headers } from "next/headers"

export async function GET() {
  // A dynamic request with an explicitly cached public fetch, as used by the
  // actual storefront. The fixture has no cart, user, order or Medusa database.
  await headers()
  const response = await fetch(process.env.CACHE_TEST_SOURCE_URL!, {
    cache: "force-cache",
    next: { tags: ["products"], revalidate: 60 },
  })
  return Response.json(await response.json())
}
