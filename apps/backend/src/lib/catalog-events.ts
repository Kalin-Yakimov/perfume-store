import {
  InventoryEvents,
  PricingEvents,
  ProductEvents,
  ProductWorkflowEvents,
  ProductVariantWorkflowEvents,
  ProductCategoryWorkflowEvents,
  ProductCollectionWorkflowEvents,
  ProductOptionWorkflowEvents,
  ProductOptionValueWorkflowEvents,
  InventoryItemWorkflowEvents,
  InventoryLevelWorkflowEvents,
  ReservationItemWorkflowEvents,
  RegionWorkflowEvents,
  SalesChannelWorkflowEvents,
  TranslationWorkflowEvents,
} from "@medusajs/framework/utils"

const actions = ["created", "updated", "deleted", "restored"]

/** Shared subscriptions for the derived catalog index and storefront cache.
 * Use the installed module/workflow event names rather than guessing aliases. */
export const CATALOG_CHANGE_EVENTS = [...new Set([
  ...Object.values(ProductEvents),
  ...Object.values(InventoryEvents),
  ...Object.values(PricingEvents),
  ...Object.values(ProductWorkflowEvents),
  ...Object.values(ProductVariantWorkflowEvents),
  ...Object.values(ProductCategoryWorkflowEvents),
  ...Object.values(ProductCollectionWorkflowEvents),
  ...Object.values(ProductOptionWorkflowEvents),
  ...Object.values(ProductOptionValueWorkflowEvents),
  ...Object.values(InventoryItemWorkflowEvents),
  ...Object.values(InventoryLevelWorkflowEvents),
  ...Object.values(ReservationItemWorkflowEvents),
  ...Object.values(RegionWorkflowEvents),
  ...Object.values(SalesChannelWorkflowEvents),
  ...Object.values(TranslationWorkflowEvents),
  "order.placed",
  "order.canceled",
  "order.completed",
  ...actions.flatMap((action) => [
    `region.region.${action}`,
    `sales_channel.sales-channel.${action}`,
    `translation.locale.${action}`,
    `translation.translation.${action}`,
    `decantStock.decant-bottle.${action}`,
    `decantStock.decant-allocation.${action}`,
    `decantStock.decant-planned-bottle.${action}`,
    `perfumeTaxonomy.perfume-taxonomy.${action}`,
  ]),
])]

export type StorefrontCacheResource =
  | "products"
  | "variants"
  | "categories"
  | "collections"
  | "regions"
  | "locales"
  | "payment_providers"
  | "perfume_taxonomies"

const catalogEvents = new Set<string>(CATALOG_CHANGE_EVENTS)

/** No event payload or customer/order identifiers leave the backend. */
export function cacheResourcesForEvent(event: string): StorefrontCacheResource[] {
  if (!catalogEvents.has(event)) return []

  // Category/collection responses embed products too. Price, inventory and
  // decant changes must evict those copies as well as the direct product cache.
  const resources: StorefrontCacheResource[] = ["products", "variants", "categories", "collections"]
  if (event.startsWith("region.")) resources.push("regions", "payment_providers")
  if (event.startsWith("translation.")) resources.push("locales")
  if (event.startsWith("perfumeTaxonomy.")) resources.push("perfume_taxonomies")
  return resources
}
