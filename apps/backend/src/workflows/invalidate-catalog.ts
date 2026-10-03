import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { CATALOG_INDEX_MODULE } from "../modules/catalog-index"
import CatalogIndexModuleService from "../modules/catalog-index/service"

const invalidateCatalogStep = createStep(
  "invalidate-catalog",
  async (_input: Record<string, never>, { container }) => {
    const catalog: CatalogIndexModuleService =
      container.resolve(CATALOG_INDEX_MODULE)
    // Derived cache only: invalidation is intentionally not compensated.
    await catalog.invalidateSnapshots()
    return new StepResponse(true)
  },
)

export const invalidateCatalogWorkflow = createWorkflow(
  "invalidate-catalog",
  function (input: Record<string, never>) {
    return new WorkflowResponse(invalidateCatalogStep(input))
  },
)
