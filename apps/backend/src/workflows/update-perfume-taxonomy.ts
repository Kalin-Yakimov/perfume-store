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

export type UpdatePerfumeTaxonomyInput = {
  id: string
  name?: string
  original_name?: string | null
  slug?: string
  image_url?: string | null
}

const updatePerfumeTaxonomyStep = createStep(
  "update-perfume-taxonomy",
  async (input: UpdatePerfumeTaxonomyInput, { container }) => {
    const service: PerfumeTaxonomyModuleService = container.resolve(
      PERFUME_TAXONOMY_MODULE
    )
    const item = await service.updatePerfumeTaxonomies(input)

    return new StepResponse(item)
  }
)

export const updatePerfumeTaxonomyWorkflow = createWorkflow(
  "update-perfume-taxonomy",
  (input: UpdatePerfumeTaxonomyInput) => {
    const item = updatePerfumeTaxonomyStep(input)

    return new WorkflowResponse(item)
  }
)
