import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { CATALOG_INDEX_MODULE } from "../modules/catalog-index"
import CatalogIndexModuleService, {
  PublishCatalogInput,
} from "../modules/catalog-index/service"

const publishCatalogSnapshotStep = createStep(
  "publish-catalog-snapshot",
  async (input: PublishCatalogInput, { container }) => {
    const catalog: CatalogIndexModuleService =
      container.resolve(CATALOG_INDEX_MODULE)
    // One atomic module transaction publishes the complete generation. A failure
    // leaves the previous snapshot untouched; this is the final workflow step.
    const snapshot = await catalog.publishSnapshot(input)
    return new StepResponse(snapshot)
  },
)

const prepareCatalogSnapshotStep = createStep(
  "prepare-catalog-snapshot",
  async (contextKey: string, { container }) => {
    const catalog: CatalogIndexModuleService =
      container.resolve(CATALOG_INDEX_MODULE)
    return new StepResponse(await catalog.prepareSnapshot(contextKey))
  },
)

export const prepareCatalogSnapshotWorkflow = createWorkflow(
  "prepare-catalog-snapshot",
  function (input: string) {
    return new WorkflowResponse(prepareCatalogSnapshotStep(input))
  },
)

export const publishCatalogSnapshotWorkflow = createWorkflow(
  "publish-catalog-snapshot",
  function (input: PublishCatalogInput) {
    return new WorkflowResponse(publishCatalogSnapshotStep(input))
  },
)
