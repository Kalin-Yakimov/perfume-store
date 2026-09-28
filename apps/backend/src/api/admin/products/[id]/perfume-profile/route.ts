import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

import { sourceMetadataForDecant } from "../../../../../lib/decant-profile"

type ProductRecord = {
  id: string
  metadata: Record<string, unknown> | null
}

type ProfileBody = {
  metadata?: Record<string, unknown>
}

export async function POST(
  req: MedusaRequest<ProfileBody>,
  res: MedusaResponse
) {
  const incoming = req.body?.metadata
  if (
    !incoming ||
    !incoming.perfume_profile ||
    typeof incoming.perfume_profile !== "object" ||
    Array.isArray(incoming.perfume_profile)
  ) {
    res.status(400).json({ message: "Липсва валиден парфюмен профил." })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "metadata"],
  })
  const products = data as ProductRecord[]
  const source = products.find((product) => product.id === req.params.id)
  if (!source || source.metadata?.listing_type === "decant") {
    res.status(404).json({ message: "Целият парфюм не беше намерен." })
    return
  }

  const sourceMetadata = {
    ...(source.metadata || {}),
    listing_type: "full_perfume",
    catalog_visible: incoming.catalog_visible === true,
    brand: incoming.brand || null,
    gender: incoming.gender || null,
    seasons: incoming.seasons || [],
    perfume_notes: incoming.perfume_notes || [],
    perfume_accords: incoming.perfume_accords || [],
    perfume_profile: incoming.perfume_profile,
  }
  const decants = products.filter(
    (product) =>
      product.metadata?.listing_type === "decant" &&
      product.metadata?.decant_source_product_id === source.id
  )

  await updateProductsWorkflow(req.scope).run({
    input: {
      products: [
        { id: source.id, metadata: sourceMetadata },
        ...decants.map((decant) => ({
          id: decant.id,
          metadata: {
            ...(decant.metadata || {}),
            ...sourceMetadataForDecant(sourceMetadata),
          },
        })),
      ],
    },
  })

  const { data: savedProducts } = await query.graph({
    entity: "product",
    filters: { id: source.id },
    fields: ["id", "title", "handle", "metadata"],
  })
  res.json({ product: savedProducts[0] })
}
