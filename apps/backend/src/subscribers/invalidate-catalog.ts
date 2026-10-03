import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { invalidateCatalogWorkflow } from "../workflows/invalidate-catalog"
import { CATALOG_CHANGE_EVENTS } from "../lib/catalog-events"
import { notifyStorefrontCache } from "../lib/notify-storefront-cache"

export default async function invalidateCatalog(args: SubscriberArgs) {
  // Independent subscribers run concurrently. Keep backend index invalidation
  // and public cache eviction in one ordered handler.
  await invalidateCatalogWorkflow(args.container).run({ input: {} })
  await notifyStorefrontCache(args)
}

export const config: SubscriberConfig = {
  event: CATALOG_CHANGE_EVENTS,
}
