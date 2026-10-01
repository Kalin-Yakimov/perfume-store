import type PerfumeTaxonomyModuleService from "./service"

export async function listAllPerfumeTaxonomies(
  service: PerfumeTaxonomyModuleService,
  filters: { kind?: "designer" | "note" | "accord" },
) {
  const items: Awaited<ReturnType<typeof service.listPerfumeTaxonomies>> = []
  const take = 100
  for (let skip = 0; ; skip += take) {
    const page = await service.listPerfumeTaxonomies(filters, {
      take,
      skip,
      order: { id: "ASC" },
    })
    items.push(...page)
    if (page.length < take) return items
  }
}
