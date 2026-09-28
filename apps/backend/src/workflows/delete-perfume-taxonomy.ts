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

const deletePerfumeTaxonomyStep = createStep(
  "delete-perfume-taxonomy",
  async (id: string, { container }) => {
    const service: PerfumeTaxonomyModuleService = container.resolve(
      PERFUME_TAXONOMY_MODULE
    )

    await service.deletePerfumeTaxonomies(id)

    return new StepResponse(id)
  }
)

export const deletePerfumeTaxonomyWorkflow = createWorkflow(
  "delete-perfume-taxonomy",
  (id: string) => {
    const deletedId = deletePerfumeTaxonomyStep(id)

    return new WorkflowResponse(deletedId)
  }
)
