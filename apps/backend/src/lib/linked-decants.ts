import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export type LinkedDecant = {
  id: string
  title: string
  handle: string | null
  status: string
  description: string | null
  thumbnail: string | null
  metadata: Record<string, unknown> | null
}

// Both properties are in the Product Module's JSON metadata, not cross-module
// filters. This avoids loading unrelated products while retaining legacy links.
export async function listLinkedDecants(
  container: MedusaContainer,
  sourceId: string,
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const result: LinkedDecant[] = []
  const take = 100
  for (let skip = 0; ; skip += take) {
    const { data } = await query.graph({
      entity: "product",
      fields: [
        "id",
        "title",
        "handle",
        "status",
        "description",
        "thumbnail",
        "metadata",
      ],
      // The generated Query DTO omits JSON fields from its filter types even
      // though the Product Module's ORM supports same-module JSON predicates.
      filters: {
        metadata: {
          listing_type: "decant",
          decant_source_product_id: sourceId,
        },
      } as Record<string, unknown>,
      pagination: { skip, take, order: { id: "ASC" } },
    })
    result.push(...(data as LinkedDecant[]))
    if (data.length < take) return result
  }
}
