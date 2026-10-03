import { randomBytes } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createStoresWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"

const { runBrowserSuite } = require("../../../../scripts/run-e2e.cjs")

jest.setTimeout(1_200_000)
if (process.env.E2E_RUN !== "1")
  throw new Error("Use npm run test:e2e with an isolated database")

async function seed(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const { result: channels } = await createSalesChannelsWorkflow(container).run(
    { input: { salesChannelsData: [{ name: "E2E storefront" }] } },
  )
  const channelId = channels[0].id
  const { result: keys } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [{ title: "E2E", type: "publishable", created_by: "" }],
    },
  })
  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: { id: keys[0].id, add: [channelId] },
  })
  await createStoresWorkflow(container).run({
    input: {
      stores: [
        {
          name: "E2E",
          default_sales_channel_id: channelId,
          supported_currencies: [{ currency_code: "eur", is_default: true }],
        },
      ],
    },
  })
  const { result: regions } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Bulgaria",
          currency_code: "eur",
          countries: ["bg"],
          automatic_taxes: false,
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  })
  const { result: locations } = await createStockLocationsWorkflow(
    container,
  ).run({
    input: {
      locations: [
        {
          name: "E2E warehouse",
          address: {
            country_code: "bg",
            city: "София",
            address_1: "Test warehouse",
          },
        },
      ],
    },
  })
  const locationId = locations[0].id
  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: locationId, add: [channelId] },
  })
  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: locationId },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
  })
  const { result: profiles } = await createShippingProfilesWorkflow(
    container,
  ).run({ input: { data: [{ name: "E2E shipping", type: "default" }] } })
  const profileId = profiles[0].id
  const fulfillment = container.resolve(Modules.FULFILLMENT)
  const set = await fulfillment.createFulfillmentSets({
    name: "E2E delivery",
    type: "shipping",
    service_zones: [
      {
        name: "Bulgaria",
        geo_zones: [{ type: "country", country_code: "bg" }],
      },
    ],
  })
  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: locationId },
    [Modules.FULFILLMENT]: { fulfillment_set_id: set.id },
  })
  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Еконт — адрес (ТЕСТ)",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: set.service_zones[0].id,
        shipping_profile_id: profileId,
        type: {
          label: "Test address",
          description: "Synthetic E2E delivery",
          code: "e2e-address",
        },
        prices: [
          { currency_code: "eur", amount: 4.49 },
          { region_id: regions[0].id, amount: 4.49 },
        ],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    ],
  })
  const { result: bottles } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "E2E House Amber",
          handle: "e2e-amber",
          status: "published",
          shipping_profile_id: profileId,
          sales_channels: [{ id: channelId }],
          metadata: {
            listing_type: "full_perfume",
            catalog_visible: true,
            brand: "E2E House",
            gender: "unisex",
          },
          options: [{ title: "Volume", values: ["100 ml"] }],
          variants: [
            {
              title: "100 ml",
              sku: "E2E-AMBER",
              metadata: { volume_ml: 100 },
              manage_inventory: true,
              allow_backorder: false,
              options: { Volume: "100 ml" },
              prices: [{ amount: 40, currency_code: "eur" }],
            },
          ],
        },
        {
          title: "E2E House Sold Out",
          handle: "e2e-sold-out",
          status: "published",
          shipping_profile_id: profileId,
          sales_channels: [{ id: channelId }],
          metadata: {
            listing_type: "full_perfume",
            catalog_visible: true,
            brand: "E2E House",
            gender: "male",
          },
          options: [{ title: "Volume", values: ["50 ml"] }],
          variants: [
            {
              title: "50 ml",
              sku: "E2E-SOLD",
              metadata: { volume_ml: 50 },
              manage_inventory: true,
              allow_backorder: false,
              options: { Volume: "50 ml" },
              prices: [{ amount: 25, currency_code: "eur" }],
            },
          ],
        },
      ],
    },
  })
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "inventory_items.inventory_item_id"],
    filters: { id: bottles.map((bottle) => bottle.variants[0].id) },
  })
  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: variants.map((variant) => {
        const inventoryItemId = variant.inventory_items?.[0]?.inventory_item_id
        if (!inventoryItemId)
          throw new Error("E2E variant has no inventory item")
        return {
          inventory_item_id: inventoryItemId,
          location_id: locationId,
          stocked_quantity: variant.id === bottles[0].variants[0].id ? 12 : 0,
        }
      }),
    },
  })
  const { result: decants } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "E2E House Amber — Отливки",
          handle: "e2e-amber-decants",
          status: "published",
          shipping_profile_id: profileId,
          sales_channels: [{ id: channelId }],
          metadata: {
            listing_type: "decant",
            catalog_visible: true,
            decant_enabled: true,
            brand: "E2E House",
            gender: "unisex",
          },
          options: [{ title: "Volume", values: ["5 ml", "10 ml"] }],
          variants: [5, 10].map((volume) => ({
            title: `${volume} ml`,
            sku: `E2E-DECANT-${volume}`,
            manage_inventory: false,
            options: { Volume: `${volume} ml` },
            prices: [{ amount: volume === 5 ? 3 : 5.3, currency_code: "eur" }],
          })),
        },
      ],
    },
  })
  const decant = decants[0]
  await container.resolve(Modules.PRODUCT).updateProducts(decant.id, {
    metadata: {
      ...decant.metadata,
      decant_source_product_id: bottles[0].id,
      decant_source_variant_id: bottles[0].variants[0].id,
      decant_source_volume_ml: 100,
      decant_enabled_variant_ids: decant.variants.map((variant) => variant.id),
      decant_variant_volumes: Object.fromEntries(
        decant.variants.map((variant) => [
          variant.id,
          variant.title.startsWith("5 ") ? 5 : 10,
        ]),
      ),
    },
  })
  return keys[0].token
}

medusaIntegrationTestRunner({
  dbName: `perfume-e2e-${randomBytes(6).toString("hex")}`,
  testSuite: ({ api, getContainer }) => {
    it("runs real browser customer journeys against the isolated Medusa HTTP app and local SMTP inbox", async () => {
      const key = await seed(getContainer())
      await runBrowserSuite(api.defaults.baseURL, key)
      const { data: orders } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "order",
          fields: [
            "id",
            "email",
            "customer_id",
            "items.title",
            "items.quantity",
            "shipping_address.country_code",
            "shipping_methods.name",
          ],
        })
      expect(orders).toHaveLength(2)
      for (const order of orders) {
        expect(order.email).toMatch(/@example\.invalid$/)
        expect(order.shipping_address?.country_code).toBe("bg")
        expect(order.items?.length).toBeGreaterThan(0)
        expect(order.shipping_methods?.[0]?.name).toBe("Еконт — адрес (ТЕСТ)")
      }
    })
  },
})
