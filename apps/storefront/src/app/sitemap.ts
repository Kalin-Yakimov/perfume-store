import { listAllProducts } from "@lib/data/products"
import { listPerfumeTaxonomies } from "@lib/data/perfume-taxonomies"
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

  const [designers, notes] = await Promise.all([
    listPerfumeTaxonomies("designer"),
    listPerfumeTaxonomies("note"),
  ])
  const taxonomyEntries: MetadataRoute.Sitemap = [
    ...designers.map((designer) => ({
      url: `${baseUrl}/dizaynerski-kashti/${encodeURIComponent(designer.slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...notes.map((note) => ({
      url: `${baseUrl}/parfyumni-notki/${encodeURIComponent(note.slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ].filter((entry) => !entry.url.endsWith("/"))

  try {
    const products = await listAllProducts({ countryCode: "bg" })
    const productEntries: MetadataRoute.Sitemap = products
      .filter((product) => product.handle && isProductVisibleInCatalog(product))
      .map((product) => ({
        url: `${baseUrl}/products/${encodeURIComponent(product.handle)}`,
        lastModified: product.updated_at
          ? new Date(product.updated_at)
          : undefined,
        changeFrequency: "weekly",
        priority: 0.8,
        images: product.thumbnail ? [product.thumbnail] : undefined,
      }))

    return [...staticEntries, ...taxonomyEntries, ...productEntries]
  } catch (error) {
    console.error("Could not load public products for sitemap", error)
    return [...staticEntries, ...taxonomyEntries]
  }
}
