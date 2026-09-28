import { listAllProducts } from "@lib/data/products"
import { getBaseURL } from "@lib/util/env"
import { isProductVisibleInCatalog } from "@lib/util/perfume-filters"
import { MetadataRoute } from "next"

export const revalidate = 3600

const publicPaths = [
  "/parfyumi",
  "/otlivki",
  "/dizaynerski-kashti",
  "/parfyumni-notki",
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseURL().replace(/\/$/, "")
  const staticEntries: MetadataRoute.Sitemap = publicPaths.map((path) => ({
    url: `${baseUrl}${path}`,
    changeFrequency:
      path === "/parfyumi" || path === "/otlivki" ? "daily" : "weekly",
    priority: path === "/parfyumi" || path === "/otlivki" ? 0.9 : 0.6,
  }))

  try {
    const products = await listAllProducts({ countryCode: "bg" })
    const productEntries: MetadataRoute.Sitemap = products
      .filter((product) => product.handle && isProductVisibleInCatalog(product))
      .map((product) => ({
        url: `${baseUrl}/products/${product.handle}`,
        lastModified: product.updated_at
          ? new Date(product.updated_at)
          : undefined,
        changeFrequency: "weekly",
        priority: 0.8,
      }))

    return [...staticEntries, ...productEntries]
  } catch (error) {
    console.error("Could not load public products for sitemap", error)
    return staticEntries
  }
}
