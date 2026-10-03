import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { linkDecantOrderWorkflow } from "../workflows/reconcile-decant-order"

/** Checkout already reserved each vial. Order placement only attaches the
 * order id; physical millilitres are deducted when staff prepares it. */
export default async function linkDecantsToOrder({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await linkDecantOrderWorkflow(container).run({
    input: { order_id: data.id },
  })
}

export const config: SubscriberConfig = { event: "order.placed" }
