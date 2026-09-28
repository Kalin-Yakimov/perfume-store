import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import {
  PERFUME_TAXONOMY_MODULE,
} from "../modules/perfume-taxonomy"
import PerfumeTaxonomyModuleService from "../modules/perfume-taxonomy/service"

export type UpsertPerfumeTaxonomyInput = {
  kind: "designer" | "note" | "accord"
  name: string
  original_name: string | null
  slug: string
  image_url: string | null
}

const upsertPerfumeTaxonomyStep = createStep(
  "upsert-perfume-taxonomy",
  async (input: UpsertPerfumeTaxonomyInput, { container }) => {
    const service: PerfumeTaxonomyModuleService = container.resolve(
      PERFUME_TAXONOMY_MODULE
    )
    const existing = await service.listPerfumeTaxonomies({
      kind: input.kind,
      slug: input.slug,
    })
    const item = existing[0]
      ? await service.updatePerfumeTaxonomies({
          id: existing[0].id,
          ...input,
        })
      : await service.createPerfumeTaxonomies(input)

    return new StepResponse({ item, created: !existing[0] })
  }
)

export const upsertPerfumeTaxonomyWorkflow = createWorkflow(
  "upsert-perfume-taxonomy",
  (input: UpsertPerfumeTaxonomyInput) => {
    const result = upsertPerfumeTaxonomyStep(input)

    return new WorkflowResponse(result)
  }
)
