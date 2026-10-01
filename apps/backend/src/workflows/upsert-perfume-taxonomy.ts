import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { PERFUME_TAXONOMY_MODULE } from "../modules/perfume-taxonomy"
import PerfumeTaxonomyModuleService from "../modules/perfume-taxonomy/service"
import { updatePerfumeTaxonomyWorkflow } from "./update-perfume-taxonomy"

export type UpsertPerfumeTaxonomyInput = {
  kind: "designer" | "note" | "accord"
  name: string
  original_name: string | null
  slug: string
  image_url: string | null
}

const findPerfumeTaxonomyForUpsertStep = createStep(
  "find-perfume-taxonomy-for-upsert",
  async (input: UpsertPerfumeTaxonomyInput, { container }) => {
    const service: PerfumeTaxonomyModuleService = container.resolve(
      PERFUME_TAXONOMY_MODULE,
    )
    const existing = await service.listPerfumeTaxonomies({
      kind: input.kind,
      slug: input.slug,
    })
    return new StepResponse(existing[0] || null)
  },
)

const createPerfumeTaxonomyForUpsertStep = createStep(
  "create-perfume-taxonomy-for-upsert",
  async (input: UpsertPerfumeTaxonomyInput, { container }) => {
    const service: PerfumeTaxonomyModuleService = container.resolve(
      PERFUME_TAXONOMY_MODULE,
    )
    const item = await service.createPerfumeTaxonomies(input)
    return new StepResponse(item, item.id)
  },
  async (id, { container }) => {
    if (!id) return
    const service: PerfumeTaxonomyModuleService = container.resolve(
      PERFUME_TAXONOMY_MODULE,
    )
    await service.softDeletePerfumeTaxonomies(id)
  },
)

export const upsertPerfumeTaxonomyWorkflow = createWorkflow(
  "upsert-perfume-taxonomy",
  function (input: UpsertPerfumeTaxonomyInput) {
    const existing = findPerfumeTaxonomyForUpsertStep(input)
    const updated = when(
      "update-existing-taxonomy",
      { existing },
      ({ existing }) => Boolean(existing),
    ).then(() => {
      const updateInput = transform(
        { input, existing },
        ({ input, existing }) => ({
          id: existing!.id,
          name: input.name,
          original_name: input.original_name,
          slug: input.slug,
          image_url: input.image_url,
        }),
      )
      // The POST/upsert path must use the same reference checks and label sync.
      return updatePerfumeTaxonomyWorkflow.runAsStep({ input: updateInput })
    })
    const created = when(
      "create-new-taxonomy",
      { existing },
      ({ existing }) => !existing,
    ).then(() => createPerfumeTaxonomyForUpsertStep(input))
    const result = transform({ updated, created }, ({ updated, created }) => ({
      item: updated || created!,
      created: Boolean(created),
    }))
    return new WorkflowResponse(result)
  },
)
