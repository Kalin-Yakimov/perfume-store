import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { PERFUME_TAXONOMY_MODULE } from "../../../modules/perfume-taxonomy"
import PerfumeTaxonomyModuleService from "../../../modules/perfume-taxonomy/service"
import { listAllPerfumeTaxonomies } from "../../../modules/perfume-taxonomy/list-all"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: PerfumeTaxonomyModuleService = req.scope.resolve(
    PERFUME_TAXONOMY_MODULE,
  )
  const requestedKind = req.query.kind
  const filters: { kind?: "designer" | "note" | "accord" } =
    requestedKind === "designer" ||
    requestedKind === "note" ||
    requestedKind === "accord"
      ? { kind: requestedKind }
      : {}
  const items = await listAllPerfumeTaxonomies(service, filters)

  res.setHeader("Cache-Control", "no-store")
  res.json({
    items: items.sort((a, b) => a.name.localeCompare(b.name, "bg")),
  })
}
