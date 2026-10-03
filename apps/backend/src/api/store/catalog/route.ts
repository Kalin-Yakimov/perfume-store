import type {
  MedusaResponse,
  MedusaStoreRequest,
} from "@medusajs/framework/http"
import type { CatalogQuery } from "./query-schema"
import { readCatalog } from "../../../modules/catalog-index/read"

export async function GET(
  req: MedusaStoreRequest & { validatedQuery: CatalogQuery },
  res: MedusaResponse,
) {
  const result = await readCatalog(req)
  // Authentication may affect group prices. Never share HTTP response caches.
  res.setHeader("Cache-Control", "no-store")
  res.json(result)
}
