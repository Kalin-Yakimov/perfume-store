import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  batchImageVariantsWorkflow,
  createSalesChannelsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateProductsWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import { PERFUME_TAXONOMY_MODULE } from "../../src/modules/perfume-taxonomy"
import type PerfumeTaxonomyModuleService from "../../src/modules/perfume-taxonomy/service"
import {
  createFullPerfumeWorkflow,
  type CreateFullPerfumeInput,
} from "../../src/workflows/create-full-perfume"
import { updateFullPerfumeWorkflow } from "../../src/workflows/update-full-perfume"
import { updateDecantSettingsWorkflow } from "../../src/workflows/update-decant-settings"
import { updatePerfumeProfileWorkflow } from "../../src/workflows/update-perfume-profile"
import { receiveFullPerfumeStockWorkflow } from "../../src/workflows/receive-full-perfume-stock"
import { listLinkedDecants } from "../../src/lib/linked-decants"
import { readSourceAndDecant } from "../../src/lib/decant-products"
import { perfumeFields } from "../../src/lib/full-perfume"

jest.setTimeout(120_000)

type SavedProduct = {
  id: string
  title: string
  metadata: Record<string, unknown> | null
  variants: {
    id: string
    title: string
    metadata: Record<string, unknown> | null
    prices: { amount: number; currency_code: string }[]
    inventory_items: {
      inventory: { location_levels: { stocked_quantity: number }[] }
    }[]
  }[]
}

medusaIntegrationTestRunner({
  testSuite: ({ getContainer, utils }) => {
    let sourceId: string
    let sourceVariantId: string
    let decantId: string
    let designerId: string
    let salesChannelId: string
    const createInput = (name: string): CreateFullPerfumeInput => ({
      name,
      designer_id: designerId,
      concentration: "Парфюмна вода",
      gender: "Унисекс",
      volume_ml: 100,
      price_eur: 45.99,
      initial_quantity: 7,
    })
    const settings = () => ({
      product_id: sourceId,
      enabled: true,
      catalog_visible: true,
      source_variant_id: sourceVariantId,
      variants: [
        { volume_ml: 5 as const, enabled: true, price_eur: 2.99 },
        { volume_ml: 10 as const, enabled: true, price_eur: 4.99 },
      ],
    })
    const read = async (id: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "product", filters: { id }, fields: perfumeFields })
      return data[0] as unknown as SavedProduct
    }
    const readImages = async (id: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "product",
          filters: { id },
          fields: [
            "id",
            "images.id",
            "images.url",
            "images.rank",
            "images.metadata",
            "images.variants.id",
          ],
        })
      return (
        data[0].images?.flatMap((image) =>
          image
            ? [
                {
                  id: image.id,
                  url: image.url,
                  rank: image.rank,
                  metadata: image.metadata,
                  variant_ids: (image.variants || []).flatMap((variant) =>
                    variant ? [variant.id] : [],
                  ).sort(),
                },
              ]
            : [],
        ) || []
      )
    }

    beforeAll(async () => {
      const container: MedusaContainer = getContainer()
      // A renamed configured default must win over the bootstrap channel's
      // display name, which is neither unique nor an authoritative setting.
      const { result: channels } = await createSalesChannelsWorkflow(
        container,
      ).run({
        input: {
          salesChannelsData: [{ name: "Product consistency storefront" }],
        },
      })
      salesChannelId = channels[0].id
      const { data: stores } = await container
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "store",
          fields: ["id"],
        })
      await updateStoresWorkflow(container).run({
        input: {
          selector: { id: stores[0].id },
          update: { default_sales_channel_id: salesChannelId },
        },
      })
      await createShippingProfilesWorkflow(container).run({
        input: {
          data: [{ name: "Product consistency shipping", type: "default" }],
        },
      })
      const { result: locations } = await createStockLocationsWorkflow(
        container,
      ).run({
        input: { locations: [{ name: "Product consistency warehouse" }] },
      })
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: { id: locations[0].id, add: [channels[0].id] },
      })
      const { data: linkedLocations } = await container
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "stock_location",
          fields: ["id", "sales_channels.id"],
        })
      expect(
        linkedLocations.some((location) =>
          location.sales_channels?.some(
            (channel) => channel?.id === channels[0].id,
          ),
        ),
      ).toBe(true)
      const taxonomy: PerfumeTaxonomyModuleService = container.resolve(
        PERFUME_TAXONOMY_MODULE,
      )
      const designer = await taxonomy.createPerfumeTaxonomies({
        kind: "designer",
        name: "Consistency House",
        slug: "consistency-house",
      })
      designerId = designer.id
      const { result } = await createFullPerfumeWorkflow(container).run({
        input: createInput("Original Bottle"),
      })
      sourceId = result.product_id
      sourceVariantId = result.product.variants[0].id
      await updateProductsWorkflow(container).run({
        input: { products: [{ id: sourceId, status: "published" }] },
      })
      const { result: decant } = await updateDecantSettingsWorkflow(
        container,
      ).run({ input: settings() })
      decantId = decant!.id
      await utils.waitWorkflowExecutions()
    })
    afterEach(async () => {
      jest.restoreAllMocks()
      await utils.waitWorkflowExecutions()
    })

    it("creates a hidden perfume with its inventory in the same compensated workflow", async () => {
      const { result } = await createFullPerfumeWorkflow(getContainer()).run({
        input: createInput("New Bottle"),
      })
      expect(result.product).toMatchObject({
        status: "draft",
        metadata: { catalog_visible: false, listing_type: "full_perfume" },
      })
      expect(result.product.variants[0]).toMatchObject({
        metadata: { volume_ml: 100 },
        prices: [{ amount: 45.99, currency_code: "eur" }],
      })
      expect(
        (result.product as unknown as SavedProduct).variants[0]
          .inventory_items[0].inventory.location_levels[0],
      ).toMatchObject({ stocked_quantity: 7 })
      const { data: assigned } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "product",
          filters: { id: result.product_id },
          fields: ["id", "sales_channels.id"],
        })
      expect(assigned[0].sales_channels?.map((channel) => channel?.id)).toEqual(
        [salesChannelId],
      )
    })

    it("removes the newly created perfume and inventory item when initial inventory fails", async () => {
      const container = getContainer()
      const inventory = container.resolve(Modules.INVENTORY)
      const [, beforeItems] = await inventory.listAndCountInventoryItems({})
      const create = jest
        .spyOn(inventory, "createInventoryLevels")
        .mockRejectedValueOnce(new Error("Test-only initial inventory failure"))
      try {
        await expect(
          createFullPerfumeWorkflow(container).run({
            input: createInput("Failed Bottle"),
          }),
        ).rejects.toMatchObject({
          message: "Test-only initial inventory failure",
        })
      } finally {
        create.mockRestore()
      }
      const products = container.resolve(Modules.PRODUCT)
      expect(
        await products.listProducts({
          title: "Consistency House Failed Bottle",
        }),
      ).toHaveLength(0)
      expect((await inventory.listAndCountInventoryItems({}))[1]).toBe(
        beforeItems,
      )
    })

    it("finds only linked decants using Product Module JSON predicates", async () => {
      expect(
        (await listLinkedDecants(getContainer(), sourceId)).map(
          (entry) => entry.id,
        ),
      ).toEqual([decantId])
      expect(
        await listLinkedDecants(getContainer(), "prod_missing_source"),
      ).toEqual([])
      const pair = await readSourceAndDecant(getContainer(), sourceId)
      expect(pair.source.id).toBe(sourceId)
      expect(pair.decant?.id).toBe(decantId)
    })

    it("saves decant visibility, enabled variants and decimal prices together without fixed volumes in the title", async () => {
      const input = settings()
      input.variants[0].price_eur = 3.79
      input.variants[1].enabled = false
      const { result } = await updateDecantSettingsWorkflow(getContainer()).run(
        { input },
      )
      const saved = await read(result!.id)
      expect(saved.title).toBe("Consistency House Original Bottle — Отливки")
      expect(saved.metadata?.decant_enabled_variant_ids).toHaveLength(1)
      const five = saved.variants.find((variant) => variant.title === "5 ml")!
      expect(five.prices[0].amount).toBe(3.79)
      expect(saved.metadata?.decant_enabled_variant_ids).toEqual([five.id])
    })

    it("rolls back decant metadata when the later pricing operation fails", async () => {
      const container = getContainer()
      await updateProductsWorkflow(container).run({
        input: {
          products: [
            {
              id: sourceId,
              images: [{ url: "https://example.invalid/source-bottle.jpg" }],
            },
          ],
        },
      })
      const before = await read(decantId)
      const imagesBefore = await readImages(decantId)
      const sourceImagesBefore = await readImages(sourceId)
      expect(sourceImagesBefore).toHaveLength(1)
      const pricing = container.resolve(Modules.PRICING)
      const upsert = jest
        .spyOn(pricing, "upsertPriceSets")
        .mockRejectedValueOnce(new Error("Test-only decant pricing failure"))
      const input = settings()
      input.catalog_visible = false
      input.variants[0].price_eur = 19.99
      try {
        await expect(
          updateDecantSettingsWorkflow(container).run({ input }),
        ).rejects.toMatchObject({
          message: "Test-only decant pricing failure",
        })
      } finally {
        upsert.mockRestore()
      }
      const after = await read(decantId)
      expect(after.metadata).toEqual(before.metadata)
      expect(await readImages(decantId)).toEqual(imagesBefore)
      expect(await readImages(sourceId)).toEqual(sourceImagesBefore)
      expect(after.variants.map((variant) => variant.prices)).toEqual(
        before.variants.map((variant) => variant.prices),
      )
      // The failed attempt releases its source lock, so a retry can succeed.
      await expect(
        updateDecantSettingsWorkflow(container).run({ input }),
      ).resolves.toMatchObject({ result: { id: decantId } })
      expect(await readImages(sourceId)).toEqual(sourceImagesBefore)
      const syncedImages = await readImages(decantId)
      expect(syncedImages.map((image) => image.url)).toEqual(
        sourceImagesBefore.map((image) => image.url),
      )
      expect(syncedImages[0].id).not.toBe(sourceImagesBefore[0].id)
    })

    it("rolls back a newly created decant if the subsequent settings update fails", async () => {
      const container = getContainer()
      const { result: newSource } = await createFullPerfumeWorkflow(
        container,
      ).run({
        input: {
          ...createInput("New Source"),
          image_url: "https://example.invalid/new-source-bottle.jpg",
        },
      })
      const sourceImagesBefore = await readImages(newSource.product_id)
      expect(sourceImagesBefore).toHaveLength(1)
      await updateProductsWorkflow(container).run({
        input: {
          products: [{ id: newSource.product_id, sales_channels: [] }],
        },
      })
      const input = {
        ...settings(),
        product_id: newSource.product_id,
        source_variant_id: newSource.product.variants[0].id,
      }
      const pricing = container.resolve(Modules.PRICING)
      const upsert = jest
        .spyOn(pricing, "upsertPriceSets")
        .mockRejectedValueOnce(
          new Error("Test-only new decant pricing failure"),
        )
      try {
        await expect(
          updateDecantSettingsWorkflow(container).run({ input }),
        ).rejects.toMatchObject({
          message: "Test-only new decant pricing failure",
        })
      } finally {
        upsert.mockRestore()
      }
      expect(await listLinkedDecants(container, newSource.product_id)).toEqual(
        [],
      )
      expect(await read(newSource.product_id)).toBeDefined()
      expect(await readImages(newSource.product_id)).toEqual(sourceImagesBefore)
      const { result: retried } = await updateDecantSettingsWorkflow(
        container,
      ).run({ input })
      const { data: assigned } = await container
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "product",
          filters: { id: [newSource.product_id, retried!.id] },
          fields: ["id", "sales_channels.id"],
        })
      expect(
        assigned
          .find((product) => product.id === retried!.id)
          ?.sales_channels?.map((channel) => channel?.id),
      ).toEqual([salesChannelId])
      expect(
        assigned.find((product) => product.id === newSource.product_id)
          ?.sales_channels,
      ).toEqual([])
    })

    it("compensates both source and linked profile updates when the final read fails", async () => {
      const container = getContainer()
      await updateProductsWorkflow(container).run({
        input: {
          products: [
            {
              id: sourceId,
              images: [
                {
                  url: "https://example.invalid/profile-source.jpg",
                  metadata: { alt: "Source detail", crop: { x: 0.3 } },
                },
                {
                  url: "https://example.invalid/profile-source-general.jpg",
                  metadata: { alt: "Source general" },
                },
              ],
            },
            {
              id: decantId,
              images: [
                {
                  url: "https://example.invalid/profile-decant.jpg",
                  metadata: { alt: "Decant detail" },
                },
                { url: "https://example.invalid/profile-decant-general.jpg" },
              ],
            },
          ],
        },
      })
      const sourceGallery = await readImages(sourceId)
      const decantGallery = await readImages(decantId)
      await batchImageVariantsWorkflow(container).run({
        input: { image_id: sourceGallery[0].id, add: [sourceVariantId] },
      })
      const decantVariantId = (await read(decantId)).variants[0].id
      await batchImageVariantsWorkflow(container).run({
        input: { image_id: decantGallery[0].id, add: [decantVariantId] },
      })
      const sourceBefore = await read(sourceId)
      const decantBefore = await read(decantId)
      const sourceImagesBefore = await readImages(sourceId)
      const decantImagesBefore = await readImages(decantId)
      expect(sourceImagesBefore).toHaveLength(2)
      expect(decantImagesBefore).toHaveLength(2)
      expect(sourceImagesBefore[0].metadata).toEqual({
        alt: "Source detail",
        crop: { x: 0.3 },
      })
      expect(sourceImagesBefore[0].variant_ids).toEqual([sourceVariantId])
      expect(sourceImagesBefore[1].variant_ids).toEqual([])
      expect(decantImagesBefore[0].variant_ids).toEqual([decantVariantId])
      expect(decantImagesBefore[1].variant_ids).toEqual([])
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const original = query.graph.bind(query)
      const graph = jest
        .spyOn(query, "graph")
        .mockImplementation(async (input, options) => {
          if (
            input.entity === "product" &&
            input.fields?.join(",") === "id,title,handle,metadata"
          )
            throw new Error("Test-only final profile read failure")
          return original(input, options)
        })
      try {
        await expect(
          updatePerfumeProfileWorkflow(container).run({
            input: {
              product_id: sourceId,
              metadata: {
                brand: "Changed House",
                catalog_visible: true,
                perfume_profile: {
                  designer_id: designerId,
                  tagline: "Changed",
                },
              },
            },
          }),
        ).rejects.toMatchObject({
          message: "Test-only final profile read failure",
        })
      } finally {
        graph.mockRestore()
      }
      expect((await read(sourceId)).metadata).toEqual(sourceBefore.metadata)
      expect((await read(decantId)).metadata).toEqual(decantBefore.metadata)
      expect(await readImages(sourceId)).toEqual(sourceImagesBefore)
      expect(await readImages(decantId)).toEqual(decantImagesBefore)
    })

    it("preserves current source and variant fields when a full-perfume price save fails", async () => {
      const container = getContainer()
      await updateProductsWorkflow(container).run({
        input: {
          products: [
            {
              id: sourceId,
              images: [
                {
                  url: "https://example.invalid/full-source.jpg",
                  metadata: { alt: "Full source detail", crop: { x: 0.2 } },
                },
              ],
            },
            {
              id: decantId,
              images: [
                {
                  url: "https://example.invalid/full-decant.jpg",
                  metadata: { alt: "Full decant detail" },
                },
              ],
            },
          ],
        },
      })
      const sourceGallery = await readImages(sourceId)
      const decantGallery = await readImages(decantId)
      await batchImageVariantsWorkflow(container).run({
        input: { image_id: sourceGallery[0].id, add: [sourceVariantId] },
      })
      const decantVariantId = (await read(decantId)).variants[0].id
      await batchImageVariantsWorkflow(container).run({
        input: { image_id: decantGallery[0].id, add: [decantVariantId] },
      })
      const before = await read(sourceId)
      const sourceImagesBefore = await readImages(sourceId)
      const decantImagesBefore = await readImages(decantId)
      expect(sourceImagesBefore).toHaveLength(1)
      expect(decantImagesBefore).toHaveLength(1)
      expect(sourceImagesBefore[0].variant_ids).toEqual([sourceVariantId])
      expect(decantImagesBefore[0].variant_ids).toEqual([decantVariantId])
      const pricing = container.resolve(Modules.PRICING)
      const upsert = jest
        .spyOn(pricing, "upsertPriceSets")
        .mockRejectedValueOnce(
          new Error("Test-only full perfume pricing failure"),
        )
      try {
        await expect(
          updateFullPerfumeWorkflow(container).run({
            input: {
              ...createInput("Changed Bottle"),
              product_id: sourceId,
              volume_ml: 75,
              price_eur: 79.99,
              image_url: "https://example.invalid/changed-bottle.jpg",
            },
          }),
        ).rejects.toMatchObject({
          message: "Test-only full perfume pricing failure",
        })
      } finally {
        upsert.mockRestore()
      }
      const after = await read(sourceId)
      expect(after.title).toBe(before.title)
      expect(after.metadata).toEqual(before.metadata)
      expect(after.variants[0].title).toBe(before.variants[0].title)
      expect(after.variants[0].metadata).toEqual(before.variants[0].metadata)
      expect(after.variants[0].prices).toEqual(before.variants[0].prices)
      expect(await readImages(sourceId)).toEqual(sourceImagesBefore)
      expect(await readImages(decantId)).toEqual(decantImagesBefore)
    })

    it("receives stock without doing a post-commit read that can report a false failure", async () => {
      const container = getContainer()
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const original = query.graph.bind(query)
      let reads = 0
      const graph = jest
        .spyOn(query, "graph")
        .mockImplementation(async (input, options) => {
          if (
            input.entity === "product" ||
            input.entity === "product_variant"
          ) {
            reads++
            if (reads > 2)
              throw new Error("No post-commit product reads allowed")
          }
          return original(input, options)
        })
      try {
        const { result } = await receiveFullPerfumeStockWorkflow(container).run(
          { input: { product_id: sourceId, received_quantity: 3 } },
        )
        expect(result).toEqual({
          stocked_quantity: 10,
          reserved_quantity: 0,
          available_quantity: 10,
        })
        expect(reads).toBe(2)
      } finally {
        graph.mockRestore()
      }
      expect(
        (await read(sourceId)).variants[0].inventory_items[0].inventory
          .location_levels[0].stocked_quantity,
      ).toBe(10)
    })
  },
})
