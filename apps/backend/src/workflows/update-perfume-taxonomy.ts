import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
  when,
} from "@medusajs/framework/workflows-sdk"

import { PERFUME_TAXONOMY_MODULE } from "../modules/perfume-taxonomy"
import PerfumeTaxonomyModuleService from "../modules/perfume-taxonomy/service"
import { Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import {
  usesPerfumeTaxonomy,
  assertTaxonomyRenameHasStableReferences,
} from "../lib/perfume-taxonomy-references"
import { listAllPerfumeTaxonomies } from "../modules/perfume-taxonomy/list-all"
import type { UpdateProductDTO } from "@medusajs/framework/types"

export type UpdatePerfumeTaxonomyInput = {
  id: string
  name?: string
  original_name?: string | null
  slug?: string
  image_url?: string | null
}

const updatePerfumeTaxonomyStep = createStep(
  "update-perfume-taxonomy",
  async (input: UpdatePerfumeTaxonomyInput, { container }) => {
    const service: PerfumeTaxonomyModuleService = container.resolve(
      PERFUME_TAXONOMY_MODULE,
    )
    const previous = await service.retrievePerfumeTaxonomy(input.id)
    if (input.name !== undefined && input.name !== previous.name) {
      await assertTaxonomyRenameHasStableReferences(
        container.resolve(Modules.PRODUCT),
        previous,
      )
    }
    const item = await service.updatePerfumeTaxonomies(input)

    return new StepResponse(
      { item, previousName: previous.name },
      {
        id: previous.id,
        name: previous.name,
        original_name: previous.original_name,
        slug: previous.slug,
        image_url: previous.image_url,
      },
    )
  },
  async (previous, { container }) => {
    if (!previous) return
    const service: PerfumeTaxonomyModuleService = container.resolve(
      PERFUME_TAXONOMY_MODULE,
    )
    await service.updatePerfumeTaxonomies(previous)
  },
)

const planTaxonomyProductLabelsStep = createStep(
  "plan-taxonomy-product-labels",
  async (
    {
      item,
      previousName,
    }: {
      item: { id: string; kind: string; name: string }
      previousName: string
    },
    { container },
  ) => {
    if (item.name === previousName)
      return new StepResponse<(UpdateProductDTO & { id: string })[]>([])
    const products = container.resolve(Modules.PRODUCT)
    const taxonomy: PerfumeTaxonomyModuleService = container.resolve(
      PERFUME_TAXONOMY_MODULE,
    )
    const taxonomies = await listAllPerfumeTaxonomies(taxonomy, {})
    const updates: (UpdateProductDTO & { id: string })[] = []
    const take = 100
    for (let skip = 0; ; skip += take) {
      const page = await products.listProducts(
        {},
        {
          select: ["id", "title", "metadata"],
          order: { id: "ASC" },
          take,
          skip,
        },
      )
      for (const product of page) {
        if (!usesPerfumeTaxonomy(product.metadata, item)) continue
        const metadata = { ...product.metadata }
        const value = metadata.perfume_profile
        const profile =
          value && typeof value === "object" && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : {}
        // Names are a search/display projection. IDs remain the source of truth.
        if (item.kind === "designer" && profile.designer_id === item.id) {
          const oldBrand = metadata.brand
          metadata.brand = item.name
          const title =
            typeof oldBrand === "string" &&
            product.title.startsWith(`${oldBrand} `)
              ? `${item.name}${product.title.slice(oldBrand.length)}`
              : product.title
          updates.push({ id: product.id, title, metadata })
        } else if (item.kind === "note") {
          const ids = [
            "top_note_ids",
            "heart_note_ids",
            "base_note_ids",
          ].flatMap((key) =>
            Array.isArray(profile[key]) ? (profile[key] as string[]) : [],
          )
          metadata.perfume_notes = [
            ...new Set(
              ids.flatMap((id) => {
                const note = taxonomies.find(
                  (entry) => entry.kind === "note" && entry.id === id,
                )
                return note ? [note.name] : []
              }),
            ),
          ]
          updates.push({ id: product.id, metadata })
        } else if (
          item.kind === "accord" &&
          Array.isArray(profile.accord_ids)
        ) {
          metadata.perfume_accords = profile.accord_ids.flatMap((id) => {
            const accord = taxonomies.find(
              (entry) => entry.kind === "accord" && entry.id === id,
            )
            return accord ? [accord.name] : []
          })
          updates.push({ id: product.id, metadata })
        }
      }
      if (page.length < take) break
    }
    return new StepResponse(updates)
  },
)

export const updatePerfumeTaxonomyWorkflow = createWorkflow(
  "update-perfume-taxonomy",
  function (input: UpdatePerfumeTaxonomyInput) {
    const updated = updatePerfumeTaxonomyStep(input)
    const products = planTaxonomyProductLabelsStep(updated)
    when(
      "sync-taxonomy-labels",
      { products },
      ({ products }) => products.length > 0,
    ).then(() => {
      updateProductsWorkflow.runAsStep({ input: { products } })
    })

    return new WorkflowResponse(updated.item)
  },
)
