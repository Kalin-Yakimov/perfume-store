import type { SubscriberArgs } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { cacheResourcesForEvent } from "./catalog-events"
import {
  createStorefrontRevalidator,
  getStorefrontRevalidationConfig,
  type RevalidationConfig,
} from "./storefront-revalidation"

let client: {
  config: RevalidationConfig
  invalidate: ReturnType<typeof createStorefrontRevalidator>
} | undefined
let warnedAt = -Infinity

/** External cache synchronization is a non-transactional, idempotent side effect.
 * A stopped storefront must never undo an otherwise successful admin write. */
export async function notifyStorefrontCache({
  event: { name },
  container,
}: SubscriberArgs) {
  const resources = cacheResourcesForEvent(name)
  if (!resources.length) return
  try {
    const settings = getStorefrontRevalidationConfig(process.env)
    if (!settings) return
    if (!client || client.config.url !== settings.url || client.config.secret !== settings.secret) {
      client = { config: settings, invalidate: createStorefrontRevalidator(settings) }
    }
    await client.invalidate(resources)
  } catch {
    // A bulk write can emit hundreds of events. One warning per minute is enough.
    if (Date.now() - warnedAt >= 60_000) {
      warnedAt = Date.now()
      const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
      logger.warn("Storefront cache sync is unavailable or misconfigured; public cache TTL remains the fallback.")
    }
  }
}
