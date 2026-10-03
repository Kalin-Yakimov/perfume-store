import {
  acquireLockStep,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  UpdatePerfumeProfileBodySchema,
  type UpdatePerfumeProfileBody,
} from "../lib/perfume-settings"
import { sourceMetadataForDecant } from "../lib/decant-profile"
import { listLinkedDecants } from "../lib/linked-decants"
import { PERFUME_TAXONOMY_MODULE } from "../modules/perfume-taxonomy"
import type PerfumeTaxonomyModuleService from "../modules/perfume-taxonomy/service"
import {
  updatePerfumeProductsWorkflow,
  type UpdatePerfumeProductsInput,
} from "./update-perfume-products"

type Input = UpdatePerfumeProfileBody & { product_id: string }

const prepareProfileStep = createStep(
  "prepare-profile",
  async (input: Input, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "product",
      filters: { id: input.product_id },
      fields: ["id", "metadata"],
    })
    const source = data[0]
    if (!source || source.metadata?.listing_type === "decant") {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Целият парфюм не беше намерен.",
      )
    }
    const parsed = UpdatePerfumeProfileBodySchema.safeParse(input)
    if (!parsed.success)
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Липсва валиден парфюмен профил.",
      )
    const incoming = parsed.data.metadata
    const profile = incoming.perfume_profile
    const taxonomy: PerfumeTaxonomyModuleService = container.resolve(
      PERFUME_TAXONOMY_MODULE,
    )
    const references = [
      {
        kind: "designer",
        ids: profile.designer_id ? [profile.designer_id] : [],
      },
      {
        kind: "note",
        ids: [
          ...(profile.top_note_ids || []),
          ...(profile.heart_note_ids || []),
          ...(profile.base_note_ids || []),
        ],
      },
      { kind: "accord", ids: profile.accord_ids || [] },
    ]
    for (const reference of references) {
      const ids = [...new Set(reference.ids)]
      if (!ids.length) continue
      const matches = await taxonomy.listPerfumeTaxonomies(
        { id: ids, kind: reference.kind },
        { take: ids.length, select: ["id"] },
      )
      if (matches.length !== ids.length) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Профилът съдържа премахната или невалидна марка, нотка или акорд. Обновете избора и запазете отново.",
        )
      }
    }
    const metadata = {
      ...(source.metadata || {}),
      listing_type: "full_perfume",
      catalog_visible: incoming.catalog_visible === true,
      brand: incoming.brand || null,
      gender: incoming.gender || null,
      seasons: incoming.seasons || [],
      perfume_notes: incoming.perfume_notes || [],
      perfume_accords: incoming.perfume_accords || [],
      perfume_profile: profile,
    }
    const decants = await listLinkedDecants(container, source.id)
    const updates: UpdatePerfumeProductsInput = {
      products: [
        { id: source.id, metadata },
        ...decants.map((decant) => ({
          id: decant.id,
          metadata: {
            ...(decant.metadata || {}),
            ...sourceMetadataForDecant(metadata),
          },
        })),
      ],
    }
    return new StepResponse(updates)
  },
)

export const updatePerfumeProfileWorkflow = createWorkflow(
  "update-perfume-profile",
  function (input: Input) {
    const key = transform(
      { input },
      ({ input }) => `perfume-settings:${input.product_id}`,
    )
    const lock = acquireLockStep({ key, timeout: 10, ttl: 120 })
    const prepared = prepareProfileStep(
      transform({ input, lock }, ({ input }) => input),
    )
    const updated = updatePerfumeProductsWorkflow.runAsStep({ input: prepared })
    const { data: saved } = useQueryGraphStep({
      entity: "product",
      filters: {
        id: transform({ updated, input }, ({ input }) => input.product_id),
      },
      fields: ["id", "title", "handle", "metadata"],
    })
    const released = releaseLockStep(
      transform({ saved, key }, ({ key }) => ({ key })),
    )
    return new WorkflowResponse(
      transform({ saved, released }, ({ saved }) => saved[0]),
    )
  },
)
