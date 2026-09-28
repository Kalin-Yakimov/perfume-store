import { MedusaContainer } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  updateProductsWorkflow,
  uploadFilesWorkflow,
} from "@medusajs/medusa/core-flows"
import { readFileSync } from "fs"
import { resolve } from "path"

import {
  PERFUME_TAXONOMY_MODULE,
} from "../modules/perfume-taxonomy"
import PerfumeTaxonomyModuleService from "../modules/perfume-taxonomy/service"

type TaxonomySeed = {
  kind: "designer" | "note" | "accord"
  name: string
  originalName?: string
  slug: string
  legacySlugs?: string[]
  asset?: {
    filename: string
    mimeType: string
  }
}

const entries: TaxonomySeed[] = [
  {
    kind: "designer",
    name: "Lattafa",
    slug: "lattafa",
    asset: { filename: "lattafa-logo.png", mimeType: "image/png" },
  },
  { kind: "designer", name: "Armaf", slug: "armaf" },
  {
    kind: "note",
    name: "Ананас",
    originalName: "Pineapple",
    slug: "ananas",
    legacySlugs: ["ананас", "pineapple"],
    asset: { filename: "ananas.jpg", mimeType: "image/jpeg" },
  },
  {
    kind: "note",
    name: "Бергамот",
    originalName: "Bergamot",
    slug: "bergamot",
    legacySlugs: ["бергамот"],
  },
  {
    kind: "note",
    name: "Ябълка",
    originalName: "Apple",
    slug: "yabalka",
    legacySlugs: ["ябълка", "apple"],
  },
  {
    kind: "note",
    name: "Жасмин",
    originalName: "Jasmine",
    slug: "zhasmin",
    legacySlugs: ["жасмин", "jasmine"],
  },
  {
    kind: "note",
    name: "Бреза",
    originalName: "Birch",
    slug: "breza",
    legacySlugs: ["бреза", "birch"],
  },
  {
    kind: "note",
    name: "Амбров акорд",
    originalName: "Amber",
    slug: "ambrov-akord",
    legacySlugs: ["амбров-акорд", "amber", "ambra"],
  },
  {
    kind: "note",
    name: "Дъбов мъх",
    originalName: "Oakmoss",
    slug: "dabov-mah",
    legacySlugs: ["дъбов-мъх", "oakmoss"],
  },
  {
    kind: "note",
    name: "Мускус",
    originalName: "Musk",
    slug: "muskus",
    legacySlugs: ["мускус", "musk"],
  },
  {
    kind: "note",
    name: "Сандалово дърво",
    originalName: "Sandalwood",
    slug: "sandalovo-darvo",
    legacySlugs: ["сандалово-дърво", "sandalwood", "sandal"],
  },
  {
    kind: "accord",
    name: "Плодов",
    originalName: "Fruity",
    slug: "plodov",
  },
  {
    kind: "accord",
    name: "Сладък",
    originalName: "Sweet",
    slug: "sladak",
  },
  {
    kind: "accord",
    name: "Бели цветя",
    originalName: "White Floral",
    slug: "beli-tsvetya",
  },
  {
    kind: "accord",
    name: "Цитрусов",
    originalName: "Citrus",
    slug: "tsitrusov",
  },
  {
    kind: "accord",
    name: "Амбров",
    originalName: "Amber",
    slug: "ambrov",
  },
  {
    kind: "accord",
    name: "Мускусен",
    originalName: "Musky",
    slug: "muskusen",
  },
]

export default async function seedPerfumeTaxonomies({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service: PerfumeTaxonomyModuleService = container.resolve(
    PERFUME_TAXONOMY_MODULE
  )
  const seededItems = new Map<string, { id: string; name: string }>()

  for (const entry of entries) {
    let existing = await service.listPerfumeTaxonomies({
      kind: entry.kind,
      slug: entry.slug,
    })

    for (const legacySlug of entry.legacySlugs || []) {
      if (existing[0]) {
        break
      }

      existing = await service.listPerfumeTaxonomies({
        kind: entry.kind,
        slug: legacySlug,
      })
    }
    let imageUrl = existing[0]?.image_url ?? null

    if (!imageUrl && entry.asset) {
      const filePath = resolve(
        process.cwd(),
        "src",
        "scripts",
        "assets",
        "perfume-taxonomy",
        entry.asset.filename
      )
      const { result } = await uploadFilesWorkflow(container).run({
        input: {
          files: [
            {
              filename: entry.asset.filename,
              mimeType: entry.asset.mimeType,
              content: readFileSync(filePath).toString("base64"),
              access: "public",
            },
          ],
        },
      })
      imageUrl = result[0]?.url ?? null
    }

    const savedItem = existing[0]
      ? await service.updatePerfumeTaxonomies({
        id: existing[0].id,
        name: entry.name,
        original_name: entry.originalName ?? null,
        slug: entry.slug,
        image_url: imageUrl,
      })
      : await service.createPerfumeTaxonomies({
          kind: entry.kind,
          name: entry.name,
          original_name: entry.originalName ?? null,
          slug: entry.slug,
          image_url: imageUrl,
        })

    seededItems.set(`${entry.kind}:${entry.slug}`, savedItem)
  }

  const productService = container.resolve(Modules.PRODUCT)
  const demoProducts = await productService.listProducts({
    handle: "demo-perfume-01",
  })
  const demoProduct = demoProducts[0]

  if (demoProduct) {
    const taxonomyId = (kind: TaxonomySeed["kind"], slug: string) =>
      seededItems.get(`${kind}:${slug}`)?.id
    const noteSlugs = {
      top: ["ananas", "bergamot", "yabalka"],
      heart: ["zhasmin", "breza", "ambrov-akord"],
      base: ["dabov-mah", "muskus", "sandalovo-darvo"],
    }
    const accordSlugs = [
      "plodov",
      "sladak",
      "beli-tsvetya",
      "tsitrusov",
      "ambrov",
      "muskusen",
    ]
    const noteIds = (slugs: string[]) =>
      slugs
        .map((slug) => taxonomyId("note", slug))
        .filter((id): id is string => Boolean(id))
    const noteNames = Object.values(noteSlugs)
      .flat()
      .map((slug) => seededItems.get(`note:${slug}`)?.name)
      .filter((name): name is string => Boolean(name))
    const accordIds = accordSlugs
      .map((slug) => taxonomyId("accord", slug))
      .filter((id): id is string => Boolean(id))
    const accordNames = accordSlugs
      .map((slug) => seededItems.get(`accord:${slug}`)?.name)
      .filter((name): name is string => Boolean(name))

    await updateProductsWorkflow(container).run({
      input: {
        selector: { id: demoProduct.id },
        update: {
          metadata: {
            ...(demoProduct.metadata || {}),
            listing_type: "full_perfume",
            catalog_visible: true,
            brand: "Lattafa",
            gender: "male",
            seasons: ["winter", "autumn"],
            perfume_notes: noteNames,
            perfume_accords: accordNames,
            perfume_profile: {
              designer_id: taxonomyId("designer", "lattafa") || null,
              concentration: "Парфюмна вода",
              tagline:
                "Топъл плодов аромат с кадифен амбров акорд, мек мускус и сух дървесен финал.",
              seasons: ["winter", "autumn"],
              longevity: "Дълготрайна",
              sillage: "Силна",
              gender: "Мъжки",
              top_note_ids: noteIds(noteSlugs.top),
              heart_note_ids: noteIds(noteSlugs.heart),
              base_note_ids: noteIds(noteSlugs.base),
              accord_ids: accordIds,
            },
          },
        },
      },
    })
  }

  logger.info(`Seeded ${entries.length} perfume taxonomy records.`)
}
