import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  MedusaError,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createProductOptionsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"

const perfumeNames = [
  "Amber Veil",
  "Velvet Rose",
  "Oud Horizon",
  "White Musk",
  "Desert Bloom",
  "Golden Saffron",
  "Midnight Cedar",
  "Silk Jasmine",
  "Citrus Mirage",
  "Vanilla Dusk",
  "Royal Patchouli",
  "Iris Smoke",
  "Ocean Noir",
  "Silver Vetiver",
  "Rose Elixir",
  "Spiced Tonka",
  "Azure Woods",
  "Leather Rain",
  "Neroli Sun",
  "Dark Plum",
  "Cashmere Oud",
  "Fig & Amber",
  "Sandal Mist",
  "Moss Reserve",
  "Pearl Magnolia",
  "Tobacco Honey",
  "Bergamot Ink",
  "Crimson Vanilla",
  "Juniper Coast",
  "Soft Suede",
  "Tea Blossom",
  "Incense Night",
  "Lemon Cedar",
  "Powdered Iris",
  "Warm Resin",
  "Aqua Musk",
]

const genders = ["male", "female", "unisex"]
const seasons = ["winter", "spring", "summer", "autumn"]

export default async function seedDemoPerfumes({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })
  const defaultSalesChannel = salesChannels[0]

  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "name"],
  })
  const shippingProfile = shippingProfiles[0]

  if (!defaultSalesChannel || !shippingProfile) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The demo store must have a sales channel and shipping profile",
    )
  }

  const { data: existingOptions } = await query.graph({
    entity: "product_option",
    fields: ["id", "title"],
  })
  let volumeOptionId = existingOptions.find(
    (option) => option.title === "Volume"
  )?.id

  if (!volumeOptionId) {
    const { result } = await createProductOptionsWorkflow(container).run({
      input: {
        product_options: [
          {
            title: "Volume",
            values: ["100 ml"],
          },
        ],
      },
    })

    volumeOptionId = result[0].id
  }

  if (!volumeOptionId) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Could not create the perfume volume option",
    )
  }

  const perfumeVolumeOptionId = volumeOptionId

  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["handle"],
  })
  const existingHandles = new Set(existingProducts.map((product) => product.handle))

  const products = perfumeNames
    .map((name, index) => {
      const number = String(index + 1).padStart(2, "0")
      const handle = `demo-perfume-${number}`
      const brand = index % 2 === 0 ? "Lattafa" : "Armaf"
      const gender = genders[index % genders.length]
      const season = seasons[index % seasons.length]
      const price = 29 + (index % 10) * 8
      const imageNumber = (index % 6) + 1

      return {
        title: `${brand} ${name}`,
        subtitle: "Тестов парфюм",
        description:
          "Временен продукт за разработване и преглед на каталога. Не е предназначен за реална продажба.",
        handle,
        weight: 450,
        status: ProductStatus.PUBLISHED,
        shipping_profile_id: shippingProfile.id,
        thumbnail: `/demo-perfumes/perfume-${imageNumber}.svg`,
        images: [
          {
            url: `/demo-perfumes/perfume-${imageNumber}.svg`,
          },
        ],
        metadata: {
          demo: true,
          brand,
          gender,
          season,
        },
        options: [{ id: perfumeVolumeOptionId }],
        variants: [
          {
            title: "100 ml",
            sku: `DEMO-PERFUME-${number}`,
            manage_inventory: false,
            options: {
              Volume: "100 ml",
            },
            prices: [
              {
                amount: price,
                currency_code: "eur",
              },
            ],
          },
        ],
        sales_channels: [{ id: defaultSalesChannel.id }],
      }
    })
    .filter((product) => !existingHandles.has(product.handle))

  if (!products.length) {
    logger.info("Demo perfumes already exist. Nothing to add.")
    return
  }

  await createProductsWorkflow(container).run({
    input: { products },
  })

  logger.info(`Added ${products.length} demo perfumes.`)
}
