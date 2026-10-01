import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { PERFUME_TAXONOMY_MODULE } from "../modules/perfume-taxonomy"
import PerfumeTaxonomyModuleService from "../modules/perfume-taxonomy/service"
import { Modules } from "@medusajs/framework/utils"
import { assertPerfumeTaxonomyUnused } from "../lib/perfume-taxonomy-references"

type DeletePerfumeTaxonomyInput = { id: string }

const deletePerfumeTaxonomyStep = createStep(
  "delete-perfume-taxonomy",
  async ({ id }: DeletePerfumeTaxonomyInput, { container }) => {
    const service: PerfumeTaxonomyModuleService = container.resolve(
      PERFUME_TAXONOMY_MODULE,
    )

    const item = await service.retrievePerfumeTaxonomy(id)
    await assertPerfumeTaxonomyUnused(container.resolve(Modules.PRODUCT), item)
    await service.softDeletePerfumeTaxonomies(id)

    return new StepResponse(id, id)
  },
  async (id, { container }) => {
    if (!id) return
    const service: PerfumeTaxonomyModuleService = container.resolve(
      PERFUME_TAXONOMY_MODULE,
    )
    await service.restorePerfumeTaxonomies(id)
  },
)

export const deletePerfumeTaxonomyWorkflow = createWorkflow(
  "delete-perfume-taxonomy",
  function (input: DeletePerfumeTaxonomyInput) {
    const deletedId = deletePerfumeTaxonomyStep(input)

    return new WorkflowResponse(deletedId)
  },
)
