import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { normalizePerfumeTaxonomySlug } from "../../../../modules/perfume-taxonomy/utils/normalize-slug"
import { deletePerfumeTaxonomyWorkflow } from "../../../../workflows/delete-perfume-taxonomy"
import { updatePerfumeTaxonomyWorkflow } from "../../../../workflows/update-perfume-taxonomy"

type UpdateBody = {
  name?: string
  original_name?: string | null
  slug?: string
  image_url?: string | null
}

export async function PATCH(
  req: MedusaRequest<UpdateBody>,
  res: MedusaResponse,
) {
  const data: UpdateBody = {}

  if (typeof req.body.name === "string") {
    data.name = req.body.name.trim()
  }

  if (
    req.body.original_name === null ||
    typeof req.body.original_name === "string"
  ) {
    data.original_name = req.body.original_name?.trim() || null
  }

  if (typeof req.body.slug === "string") {
    data.slug = normalizePerfumeTaxonomySlug(req.body.slug)
  }

  if (req.body.image_url === null || typeof req.body.image_url === "string") {
    data.image_url = req.body.image_url
  }

  const { result: item } = await updatePerfumeTaxonomyWorkflow(req.scope).run({
    input: {
      id: req.params.id,
      ...data,
    },
  })

  res.json({ item })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  await deletePerfumeTaxonomyWorkflow(req.scope).run({
    input: { id: req.params.id },
  })
  res.status(200).json({ id: req.params.id, deleted: true })
}
