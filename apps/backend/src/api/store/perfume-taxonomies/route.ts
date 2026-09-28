import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import {
  PERFUME_TAXONOMY_MODULE,
} from "../../../modules/perfume-taxonomy"
import PerfumeTaxonomyModuleService from "../../../modules/perfume-taxonomy/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: PerfumeTaxonomyModuleService = req.scope.resolve(
    PERFUME_TAXONOMY_MODULE
  )
  const requestedKind = req.query.kind
  const filters =
    requestedKind === "designer" ||
    requestedKind === "note" ||
    requestedKind === "accord"
      ? { kind: requestedKind }
      : {}
  const items = await service.listPerfumeTaxonomies(filters)

  res.setHeader("Cache-Control", "no-store")
  res.json({
    items: items.sort((a, b) => a.name.localeCompare(b.name, "bg")),
  })
}
