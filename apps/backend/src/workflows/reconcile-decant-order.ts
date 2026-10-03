import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import {
  linkDecantAllocationsForOrder,
  releaseDecantAllocationsForOrder,
} from "./decant-order-operations"

type Input = { order_id: string }

const linkDecantOrderStep = createStep(
  "link-decant-order",
  async ({ order_id }: Input, { container }) => {
    await linkDecantAllocationsForOrder(container, order_id)
    return new StepResponse(true)
  },
)

const releaseCanceledDecantOrderStep = createStep(
  "release-canceled-decant-order",
  async ({ order_id }: Input, { container }) => {
    // The helper compensates partial failures before releasing its stock locks.
    await releaseDecantAllocationsForOrder(container, order_id)
    return new StepResponse(true)
  },
)

export const linkDecantOrderWorkflow = createWorkflow(
  "link-decant-order",
  function (input: Input) {
    return new WorkflowResponse(linkDecantOrderStep(input))
  },
)

export const releaseCanceledDecantOrderWorkflow = createWorkflow(
  "release-canceled-decant-order",
  function (input: Input) {
    return new WorkflowResponse(releaseCanceledDecantOrderStep(input))
  },
)
