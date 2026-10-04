import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function readDecantStockProductNames(
  container: MedusaContainer,
  sourceIds: string[],
) {
  const ids = [...new Set(sourceIds)]
  const products: { id: string; title: string }[] = []
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  for (let offset = 0; offset < ids.length; offset += 100) {
    const page = ids.slice(offset, offset + 100)
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "title"],
      filters: { id: page },
      pagination: { take: page.length, skip: 0 },
    })
    products.push(...data.map(({ id, title }) => ({ id, title })))
  }
  return products
}
