import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { PERFUME_TAXONOMY_MODULE } from "../../../modules/perfume-taxonomy"
import PerfumeTaxonomyModuleService from "../../../modules/perfume-taxonomy/service"
import { listAllPerfumeTaxonomies } from "../../../modules/perfume-taxonomy/list-all"
import { normalizePerfumeTaxonomySlug } from "../../../modules/perfume-taxonomy/utils/normalize-slug"
import { upsertPerfumeTaxonomyWorkflow } from "../../../workflows/upsert-perfume-taxonomy"

type TaxonomyKind = "designer" | "note" | "accord"

type TaxonomyBody = {
  kind?: TaxonomyKind
  name?: string
  original_name?: string | null
  slug?: string
  image_url?: string | null
}

const isKind = (value: unknown): value is TaxonomyKind =>
  value === "designer" || value === "note" || value === "accord"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: PerfumeTaxonomyModuleService = req.scope.resolve(
    PERFUME_TAXONOMY_MODULE,
  )
  const requestedKind = req.query.kind
  const filters = isKind(requestedKind) ? { kind: requestedKind } : {}
  const items = await listAllPerfumeTaxonomies(service, filters)

  res.json({
    items: items.sort((a, b) =>
      `${a.kind}-${a.name}`.localeCompare(`${b.kind}-${b.name}`, "bg"),
    ),
  })
}

export async function POST(
  req: MedusaRequest<TaxonomyBody>,
  res: MedusaResponse,
) {
  const body = req.body
  const name = body.name?.trim()
  const slug = normalizePerfumeTaxonomySlug(body.slug || body.name || "")

  if (!isKind(body.kind) || !name || !slug) {
    res.status(400).json({
      message: "Kind, name, and a valid slug are required.",
    })
    return
  }

  const data = {
    kind: body.kind,
    name,
    original_name:
      body.kind === "designer" ? null : body.original_name?.trim() || null,
    slug,
    image_url: body.image_url?.trim() || null,
  }
  const { result } = await upsertPerfumeTaxonomyWorkflow(req.scope).run({
    input: data,
  })

  res.status(result.created ? 201 : 200).json({ item: result.item })
}
