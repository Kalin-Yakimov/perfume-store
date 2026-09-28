import type { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

type Product = {
  id: string
  title: string
  metadata?: Record<string, unknown> | null
  variants?: { id: string; title: string; sku?: string | null }[]
}

/** One-time, idempotent upgrade for linked decants created before the source
 * whole-bottle variant became an explicit setting. Ambiguous products are left
 * untouched for an administrator to configure in the product page. */
export default async function backfillDecantSourceVariants({
  container,
}: {
  container: MedusaContainer
}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "title", "metadata", "variants.id", "variants.title", "variants.sku"],
  })
  const products = data as Product[]
  const byId = new Map(products.map((product) => [product.id, product]))
  let updated = 0

  for (const decant of products) {
    const metadata = decant.metadata
    if (metadata?.listing_type !== "decant") continue
    const source = typeof metadata.decant_source_product_id === "string"
      ? byId.get(metadata.decant_source_product_id)
      : undefined
    if (!source) continue

    const selected = typeof metadata.decant_source_variant_id === "string"
      ? source.variants?.find((variant) => variant.id === metadata.decant_source_variant_id)
      : source.variants?.length === 1
        ? source.variants[0]
        : undefined
    if (!selected) {
      logger.warn(`Decant ${decant.id} needs an explicit source variant in the product page.`)
      continue
    }
    const match = `${selected.title} ${selected.sku || ""}`.match(/(\d+(?:[.,]\d+)?)\s*ml/i)
    const volume = match ? Number(match[1].replace(",", ".")) : undefined
    if (!volume || volume <= 5) {
      logger.warn(`Decant ${decant.id} has no valid source bottle volume.`)
      continue
    }

    const title = `${source.title} — Отливки (5/10 ml)`
    if (
      metadata.decant_source_variant_id === selected.id &&
      Number(metadata.decant_source_volume_ml) === volume &&
      decant.title === title
    ) continue

    await updateProductsWorkflow(container).run({
      input: {
        products: [{
          id: decant.id,
          title,
          metadata: {
            ...metadata,
            decant_source_variant_id: selected.id,
            decant_source_volume_ml: volume,
          },
        }],
      },
    })
    updated++
  }
  logger.info(`Updated ${updated} linked decant product(s).`)
}
