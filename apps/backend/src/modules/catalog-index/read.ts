import { createHash, randomUUID } from "node:crypto"
import type { MedusaStoreRequest } from "@medusajs/framework/http"
import type { HttpTypes } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  QueryContext,
} from "@medusajs/framework/utils"
import {
  transformAndValidateSalesChannelIds,
  wrapVariantsWithInventoryQuantityForSalesChannel,
} from "@medusajs/medusa/api/utils/middlewares/products/index"
import { wrapProductsWithTaxPrices } from "@medusajs/medusa/api/store/products/helpers"
import { CatalogQuery } from "../../api/store/catalog/query-schema"
import {
  prepareCatalogSnapshotWorkflow,
  publishCatalogSnapshotWorkflow,
} from "../../workflows/publish-catalog-snapshot"
import { maxAdditionalDecantQuantity } from "../decant-stock/cart-preview"
import { PERFUME_TAXONOMY_MODULE } from "../perfume-taxonomy"
import PerfumeTaxonomyModuleService from "../perfume-taxonomy/service"
import { listAllPerfumeTaxonomies } from "../perfume-taxonomy/list-all"
import { CATALOG_INDEX_MODULE } from "."
import CatalogIndexModuleService from "./service"
import { projectCatalogProduct, CatalogProduct } from "./projection"
import { catalogFilters, catalogOrder } from "./filters"

type Request = MedusaStoreRequest & { validatedQuery: CatalogQuery }
const projectionFields = [
  "id",
  "status",
  "title",
  "subtitle",
  "handle",
  "metadata",
  "created_at",
  "collection_id",
  "collection.title",
  "tags.value",
  "categories.id",
  "categories.is_active",
  "categories.is_internal",
  "variants.id",
  "variants.title",
  "variants.sku",
  "variants.manage_inventory",
  "variants.allow_backorder",
  "variants.options.id",
  "variants.calculated_price.*",
]
const pageFields = [
  "id",
  "status",
  "title",
  "handle",
  "thumbnail",
  "metadata",
  "created_at",
  "collection_id",
  "collection.title",
  "images.id",
  "images.url",
  "variants.id",
  "variants.title",
  "variants.sku",
  "variants.metadata",
  "variants.manage_inventory",
  "variants.allow_backorder",
  "variants.options.id",
  "variants.options.value",
  "variants.calculated_price.*",
]

async function readProducts(req: Request, ids: string[], fields: string[]) {
  if (!ids.length) return []
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph(
    {
      entity: "product",
      filters: { id: ids, status: "published" },
      fields,
      pagination: { take: ids.length, skip: 0 },
      context: {
        variants: { calculated_price: QueryContext(req.pricingContext || {}) },
      },
    },
    { locale: req.locale },
  )
  const products = data as CatalogProduct[]
  await wrapVariantsWithInventoryQuantityForSalesChannel(
    req,
    products.flatMap((product) => product.variants || []),
  )
  return products
}

const visible = (product: HttpTypes.StoreProduct) =>
  product.metadata?.catalog_visible === true || product.metadata?.demo === true

async function unavailable(
  req: Request,
  product: HttpTypes.StoreProduct,
  channel: string,
) {
  if (product.metadata?.listing_type !== "decant")
    return !(product.variants || []).some(
      (variant) =>
        !variant.manage_inventory ||
        variant.allow_backorder ||
        (variant.inventory_quantity || 0) > 0,
    )
  const metadata = product.metadata || {}
  const enabled = Array.isArray(metadata.decant_enabled_variant_ids)
    ? metadata.decant_enabled_variant_ids
    : []
  const volumes =
    metadata.decant_variant_volumes &&
    typeof metadata.decant_variant_volumes === "object"
      ? (metadata.decant_variant_volumes as Record<string, unknown>)
      : {}
  const candidates = (product.variants || [])
    .filter(
      (variant) =>
        enabled.includes(variant.id) && Number(volumes[variant.id]) > 0,
    )
    .sort((a, b) => Number(volumes[a.id]) - Number(volumes[b.id]))
  if (
    metadata.decant_enabled !== true ||
    metadata.catalog_visible !== true ||
    !candidates.length
  )
    return true
  try {
    // For a catalog boolean the smallest enabled vial is enough. Do not run
    // the more expensive maximum-quantity preview for every size.
    return (
      (await maxAdditionalDecantQuantity(
        req.scope,
        [],
        product.id,
        candidates[0].id,
        channel,
      )) === 0
    )
  } catch (error) {
    if (
      error instanceof MedusaError &&
      error.type === MedusaError.Types.INVALID_DATA
    ) {
      req.scope
        .resolve(ContainerRegistrationKeys.LOGGER)
        .warn(`Catalog decant configuration invalid: ${product.id}`)
      return true
    }
    throw error
  }
}

async function ensureSnapshot(
  req: Request,
  channel: string,
  contextKey: string,
) {
  const catalog: CatalogIndexModuleService =
    req.scope.resolve(CATALOG_INDEX_MODULE)
  const readSnapshot = async () =>
    (
      await catalog.listCatalogSnapshots(
        { context_key: contextKey },
        { take: 1 },
      )
    )[0]
  const current = await readSnapshot()
  if (current && new Date(current.expires_at).getTime() > Date.now())
    return current
  return await req.scope.resolve(Modules.LOCKING).execute(
    `catalog-refresh:${contextKey}`,
    async () => {
      const previous = await readSnapshot()
      if (previous && new Date(previous.expires_at).getTime() > Date.now())
        return previous
      const { result: prepared } = await prepareCatalogSnapshotWorkflow(
        req.scope,
      ).run({ input: contextKey })
      const generation = randomUUID()
      const revision = prepared.revision
      const taxonomy: PerfumeTaxonomyModuleService = req.scope.resolve(
        PERFUME_TAXONOMY_MODULE,
      )
      const taxonomies = await listAllPerfumeTaxonomies(taxonomy, {})
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const entries: ReturnType<typeof projectCatalogProduct>[] = []
      for (let skip = 0; ; skip += 100) {
        // Query the link itself to enforce the publishable key's sales channel,
        // including stores with just one channel (no implicit channel bypass).
        const { data: links } = await query.graph({
          entity: "product_sales_channel",
          fields: ["product_id"],
          filters: { sales_channel_id: channel },
          pagination: { take: 100, skip, order: { product_id: "ASC" } },
        })
        const ids = links.map((link) => link.product_id as string)
        const products = (
          await readProducts(req, ids, projectionFields)
        ).filter(visible)
        for (let offset = 0; offset < products.length; offset += 6) {
          entries.push(
            ...(await Promise.all(
              products
                .slice(offset, offset + 6)
                .map(async (product) =>
                  projectCatalogProduct(
                    product,
                    taxonomies,
                    contextKey,
                    generation,
                    await unavailable(req, product, channel),
                  ),
                ),
            )),
          )
        }
        if (links.length < 100) break
      }
      const { result } = await publishCatalogSnapshotWorkflow(req.scope).run({
        input: {
          context_key: contextKey,
          generation,
          revision,
          entries,
        },
      })
      return result
    },
    // A rebuild does not occupy a database connection while waiting or scanning.
    // Snapshot row locks coordinate publishers/invalidation across processes.
    { provider: "in-memory", timeout: 60 },
  )
}

export async function readCatalog(req: Request) {
  const input = req.validatedQuery
  const channels = transformAndValidateSalesChannelIds(req)
  if (channels.length !== 1)
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Catalog requires one sales channel",
    )
  const groups =
    req.pricingContext?.customer?.groups?.map((group) => group.id).sort() || []
  // Groups, not customer IDs: no personal data in the shared projection.
  const contextKey = createHash("sha256")
    .update(
      JSON.stringify([
        input.region_id,
        channels[0],
        req.pricingContext?.currency_code,
        groups,
        req.locale || null,
      ]),
    )
    .digest("hex")
  let snapshot = await ensureSnapshot(req, channels[0], contextKey)
  // One bounded retry if a mutation arrived while the projection was rebuilt.
  if (new Date(snapshot.expires_at).getTime() <= Date.now())
    snapshot = await ensureSnapshot(req, channels[0], contextKey)
  const catalog: CatalogIndexModuleService =
    req.scope.resolve(CATALOG_INDEX_MODULE)
  const filters = catalogFilters(contextKey, snapshot.generation, input)
  const [rows, count] = await catalog.listAndCountCatalogEntries(filters, {
    select: ["product_id", "unavailable"],
    skip: input.offset,
    take: input.limit,
    order: catalogOrder(input.sort),
  })
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: pageLinks } = rows.length
    ? await query.graph({
        entity: "product_sales_channel",
        fields: ["product_id"],
        filters: {
          product_id: rows.map((row) => row.product_id),
          sales_channel_id: channels[0],
        },
        pagination: { take: rows.length, skip: 0 },
      })
    : { data: [] }
  const products = (
    await readProducts(
      req,
      pageLinks.map((link) => link.product_id as string),
      pageFields,
    )
  ).filter(visible)
  await wrapProductsWithTaxPrices(req, products)
  const byId = new Map(products.map((product) => [product.id, product]))
  const brands = new Map<string, { value: string; label: string }>()
  let maxPrice = 0
  if (input.facets === "true") {
    const baseFilters = catalogFilters(
      contextKey,
      snapshot.generation,
      input,
      true,
    )
    for (let skip = 0; ; skip += 100) {
      const facetRows = await catalog.listCatalogEntries(baseFilters, {
        select: ["brand_value", "brand_label", "price"],
        take: 100,
        skip,
        order: { product_id: "ASC" },
      })
      for (const row of facetRows) {
        if (row.brand_value && row.brand_label)
          brands.set(row.brand_value, {
            value: row.brand_value,
            label: row.brand_label,
          })
        if (row.price !== null) maxPrice = Math.max(maxPrice, row.price)
      }
      if (facetRows.length < 100) break
    }
  }
  return {
    products: rows.flatMap((row) =>
      byId.has(row.product_id) ? [byId.get(row.product_id)!] : [],
    ),
    count,
    offset: input.offset,
    limit: input.limit,
    unavailable_product_ids: rows
      .filter((row) => row.unavailable && byId.has(row.product_id))
      .map((row) => row.product_id),
    facets: {
      brands: [...brands.values()].sort((a, b) =>
        a.label.localeCompare(b.label, "bg"),
      ),
      price_max: Math.max(5, Math.ceil(maxPrice / 5) * 5),
    },
  }
}
