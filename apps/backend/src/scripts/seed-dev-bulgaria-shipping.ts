import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  ModuleRegistrationName,
  Modules,
} from "@medusajs/framework/utils"
import { createShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Development-only sample shipping rates for the Bulgarian checkout.
 * These are deliberately marked as test rates and must be replaced before
 * accepting real orders. Safe to rerun: existing named options are skipped.
 */
const DEV_RATES = [
  { name: "Еконт — офис (ТЕСТ)", code: "dev-econt-office", amount: 2.99 },
  { name: "Еконт — адрес (ТЕСТ)", code: "dev-econt-address", amount: 4.49 },
  { name: "Спиди — офис (ТЕСТ)", code: "dev-speedy-office", amount: 2.99 },
  { name: "Спиди — адрес (ТЕСТ)", code: "dev-speedy-address", amount: 4.49 },
  { name: "Спиди — автомат (ТЕСТ)", code: "dev-speedy-locker", amount: 1.99 },
  { name: "BOX NOW — автомат (ТЕСТ)", code: "dev-boxnow-locker", amount: 2.49 },
] as const

const DEV_FULFILLMENT_SET = "Bulgaria development delivery"
const DEV_ZONE = "Bulgaria development zone"

export default async function seedDevBulgariaShipping({
  container,
}: {
  container: MedusaContainer
}) {
  if (process.env.NODE_ENV !== "development") {
    throw new Error(
      "Test courier rates can only be seeded when NODE_ENV=development.",
    )
  }

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const fulfillment = container.resolve(ModuleRegistrationName.FULFILLMENT)

  const [{ data: regions }, { data: profiles }, { data: locations }, { data: sets }, { data: existingOptions }] =
    await Promise.all([
      query.graph({
        entity: "region",
        fields: ["id", "currency_code", "countries.iso_2"],
      }),
      query.graph({ entity: "shipping_profile", fields: ["id", "name"] }),
      query.graph({ entity: "stock_location", fields: ["id", "name"] }),
      query.graph({ entity: "fulfillment_set", fields: ["id", "name"] }),
      query.graph({ entity: "shipping_option", fields: ["id", "name"] }),
    ])

  const region = (regions as any[]).find((item) =>
    item.countries?.some((country: { iso_2: string }) => country.iso_2 === "bg"),
  )
  const profile = (profiles as any[])[0]
  const location = (locations as any[]).find((item) =>
    item.name?.toLocaleLowerCase("en").includes("warehouse"),
  ) ?? (locations as any[])[0]

  if (!region || !profile || !location) {
    throw new Error(
      "A EUR region containing Bulgaria, a shipping profile, and a stock location are required before adding test shipping rates.",
    )
  }
  if (region.currency_code !== "eur") {
    throw new Error("The Bulgarian region must use EUR for these sample rates.")
  }

  const allSets = sets as { id: string; name: string }[]
  let fulfillmentSet = allSets.find((item) => item.name === DEV_FULFILLMENT_SET)
  if (!fulfillmentSet) {
    const created = await fulfillment.createFulfillmentSets({
      name: DEV_FULFILLMENT_SET,
      type: "shipping",
      service_zones: [
        {
          name: DEV_ZONE,
          geo_zones: [{ country_code: "bg", type: "country" }],
        },
      ],
    })
    fulfillmentSet = created
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    })
  }

  const serviceZone = await query.graph({
    entity: "service_zone",
    fields: ["id", "name", "fulfillment_set.id"],
    filters: { name: DEV_ZONE },
  })
  const zone = (serviceZone.data as any[]).find((item) =>
    item.fulfillment_set?.id === fulfillmentSet?.id,
  )
  if (!zone) {
    throw new Error("Could not locate the Bulgarian test delivery service zone.")
  }

  const existingNames = new Set(
    (existingOptions as { name: string }[]).map((item) => item.name),
  )
  const missingRates = DEV_RATES.filter((rate) => !existingNames.has(rate.name))
  if (!missingRates.length) {
    logger.info("Bulgarian sample shipping rates already exist; no changes made.")
    return
  }

  await createShippingOptionsWorkflow(container).run({
    input: missingRates.map((rate) => ({
      name: rate.name,
      price_type: "flat" as const,
      provider_id: "manual_manual",
      service_zone_id: zone.id,
      shipping_profile_id: profile.id,
      type: {
        label: rate.code,
        description: "Временна тарифа само за разработка — не е оферта на куриера.",
        code: rate.code,
      },
      prices: [
        { currency_code: "eur", amount: rate.amount },
        { region_id: region.id, amount: rate.amount },
      ],
      rules: [
        { attribute: "enabled_in_store", value: "true", operator: "eq" as const },
        { attribute: "is_return", value: "false", operator: "eq" as const },
      ],
    })),
  })

  logger.info(
    `Added ${missingRates.length} clearly marked development shipping rates for Bulgaria. Replace them with contracted courier prices before launch.`,
  )
}
