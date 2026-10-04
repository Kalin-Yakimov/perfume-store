import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { FullPerfumeListQuery } from "../api/admin/full-perfumes/query-schema"

// These fields are for the list only. Inventory, descriptions and the complete
// edit form are loaded by the detail endpoint, never for the whole catalog.
const listFields = [
  "id",
  "title",
  "status",
  "thumbnail",
  "metadata",
  "variants.id",
  "variants.title",
  "variants.metadata",
  "variants.prices.amount",
  "variants.prices.currency_code",
]

export function fullPerfumeListFilters(q?: string) {
  const and: Record<string, unknown>[] = [
    {
      $or: [
        { metadata: { listing_type: "full_perfume" } },
        {
          $and: [
            {
              $or: [
                { metadata: { listing_type: null } },
                { metadata: { listing_type: { $ne: "decant" } } },
              ],
            },
            {
              $or: [
                { metadata: { brand: { $ne: null } } },
                { metadata: { perfume_profile: { $ne: null } } },
              ],
            },
          ],
        },
      ],
    },
  ]
  // Literal terms, not user-supplied SQL wildcards. Match across title/brand,
  // without transferring or filtering every product in the browser.
  for (const term of q?.trim().split(/\s+/).filter(Boolean) || []) {
    const contains = { $ilike: `%${term.replace(/[\\%_]/g, "\\$&")}%` }
    and.push({
      $or: [
        { title: contains },
        { handle: contains },
        { metadata: { brand: contains } },
      ],
    })
  }
  return { $and: and }
}

export async function readFullPerfumeList(
  container: MedusaContainer,
  input: FullPerfumeListQuery,
) {
  const { data, metadata } = await container
    .resolve(ContainerRegistrationKeys.QUERY)
    .graph({
      entity: "product",
      fields: listFields,
      filters: fullPerfumeListFilters(input.q),
      pagination: {
        skip: input.offset,
        take: input.limit,
        order: { title: "ASC", id: "ASC" },
      },
    })
  return {
    products: data,
    count: metadata?.count || 0,
    offset: input.offset,
    limit: input.limit,
  }
}
