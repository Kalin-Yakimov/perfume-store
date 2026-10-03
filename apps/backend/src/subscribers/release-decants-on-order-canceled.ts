import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { releaseCanceledDecantOrderWorkflow } from "../workflows/reconcile-decant-order"

export default async function releaseDecantsOnOrderCanceled({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await releaseCanceledDecantOrderWorkflow(container).run({
    input: { order_id: data.id },
  })
}

export const config: SubscriberConfig = { event: "order.canceled" }
