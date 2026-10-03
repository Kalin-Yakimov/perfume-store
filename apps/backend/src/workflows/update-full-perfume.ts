import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  ContainerRegistrationKeys,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  acquireLockStep,
  releaseLockStep,
  updateProductVariantsWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import type {
  UpdateProductVariantsWorkflowInput,
} from "@medusajs/medusa/core-flows"

import { isFullPerfume, perfumeFields } from "../lib/full-perfume"
import { sourceMetadataForDecant } from "../lib/decant-profile"
import { readBottleVolumeMl } from "../lib/perfume-volume"
import { listLinkedDecants } from "../lib/linked-decants"
import { decantSourceLock } from "../modules/decant-stock/reservation"
import { UpdateFullPerfumeBodySchema } from "../lib/perfume-settings"
import { DECANT_STOCK_MODULE } from "../modules/decant-stock"
import DecantStockModuleService from "../modules/decant-stock/service"
import { PERFUME_TAXONOMY_MODULE } from "../modules/perfume-taxonomy"
import PerfumeTaxonomyModuleService from "../modules/perfume-taxonomy/service"
import {
  updatePerfumeProductsWorkflow,
  type UpdatePerfumeProductsInput,
} from "./update-perfume-products"

export type UpdateFullPerfumeInput = {
  product_id: string
  name?: string
  designer_id?: string
  concentration?: string
  gender?: string
  volume_ml?: number
  price_eur?: number
  description?: string
  image_url?: string
  catalog_visible?: boolean
}

type Product = {
  id: string
  title: string
  handle: string | null
  status: string
  description: string | null
  thumbnail: string | null
  metadata: Record<string, unknown> | null
  variants?: {
    id: string
    title: string
    sku: string | null
    metadata: Record<string, unknown> | null
  }[]
}

export type UpdateFullPerfumeResult =
  | { product: Product; error?: never }
  | {
      product?: never
      error: { code: "not_found" | "invalid" | "conflict"; message: string }
    }

type Prepared =
  | {
      updates: UpdatePerfumeProductsInput
      variant_updates: UpdateProductVariantsWorkflowInput
      error?: never
    }
  | {
      updates?: never
      variant_updates?: never
      error: { code: "not_found" | "invalid" | "conflict"; message: string }
    }

const genderCode = (value: string) =>
  value === "Мъжки"
    ? "male"
    : value === "Женски"
      ? "female"
      : value === "Унисекс"
        ? "unisex"
        : null

const failure = (code: "not_found" | "invalid" | "conflict", message: string) =>
  ({ error: { code, message } }) as Prepared

const prepareFullPerfumeUpdateStep = createStep(
  "prepare-full-perfume-update",
  async (input: UpdateFullPerfumeInput, { container }) => {
    const parsed = UpdateFullPerfumeBodySchema.safeParse(input)
    if (!parsed.success)
      return new StepResponse<Prepared>(
        failure(
          "invalid",
          "Попълнете валидни данни за парфюма, обема и цената.",
        ),
      )
    input = { ...parsed.data, product_id: input.product_id }
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: target } = await query.graph({
      entity: "product",
      filters: { id: input.product_id },
      fields: perfumeFields,
    })
    const product = (target as Product[]).find((item) =>
      isFullPerfume(item.metadata),
    )
    if (!product) {
      return new StepResponse<Prepared>(
        failure("not_found", "Парфюмът не беше намерен."),
      )
    }
    if (product.variants?.length !== 1) {
      return new StepResponse<Prepared>(
        failure(
          "conflict",
          "Този по-стар продукт има повече от една разфасовка. Редактирайте го от стандартната продуктова страница.",
        ),
      )
    }

    const oldProfile =
      typeof product.metadata?.perfume_profile === "object" &&
      product.metadata.perfume_profile !== null &&
      !Array.isArray(product.metadata.perfume_profile)
        ? (product.metadata.perfume_profile as Record<string, unknown>)
        : {}
    const name =
      input.name?.trim() ||
      (typeof product.metadata?.perfume_name === "string"
        ? product.metadata.perfume_name
        : product.title)
    const designerId =
      input.designer_id?.trim() ||
      (typeof oldProfile.designer_id === "string" ? oldProfile.designer_id : "")
    const concentration =
      input.concentration?.trim() ??
      (typeof oldProfile.concentration === "string"
        ? oldProfile.concentration
        : "")
    const gender =
      input.gender?.trim() ??
      (typeof oldProfile.gender === "string" ? oldProfile.gender : "")
    const volumeMl = Number(input.volume_ml)
    const priceEur = Number(input.price_eur)
    if (
      !name ||
      !designerId ||
      !Number.isInteger(volumeMl) ||
      volumeMl <= 5 ||
      volumeMl > 1000 ||
      !Number.isFinite(priceEur) ||
      priceEur <= 0
    ) {
      return new StepResponse<Prepared>(
        failure(
          "invalid",
          "Попълнете име, дизайнерска къща, обем над 5 мл и цена в евро.",
        ),
      )
    }
    if (!concentration || !genderCode(gender)) {
      return new StepResponse<Prepared>(
        failure("invalid", "Изберете концентрация и пол."),
      )
    }

    const taxonomy: PerfumeTaxonomyModuleService = container.resolve(
      PERFUME_TAXONOMY_MODULE,
    )
    const designers = await taxonomy.listPerfumeTaxonomies({
      id: designerId,
      kind: "designer",
    })
    const designer = designers[0]
    if (!designer) {
      return new StepResponse<Prepared>(
        failure("invalid", "Изберете съществуваща дизайнерска къща."),
      )
    }

    const variant = product.variants[0]
    const previousVolume = readBottleVolumeMl(variant)
    if (previousVolume !== volumeMl) {
      const stock: DecantStockModuleService =
        container.resolve(DECANT_STOCK_MODULE)
      const [open, planned] = await Promise.all([
        stock.listDecantBottles({
          source_product_id: product.id,
          status: "active",
        }),
        stock.listDecantPlannedBottles({
          source_product_id: product.id,
          status: "planned",
        }),
      ])
      const mismatchedBottles = [...open, ...planned].some(
        (bottle) => Number(bottle.source_volume_ml) !== volumeMl,
      )
      if (mismatchedBottles) {
        return new StepResponse<Prepared>(
          failure(
            "conflict",
            "Обемът не може да се променя, докато има отворени или заделени бутилки с друг обем за отливки.",
          ),
        )
      }
    }

    const cleanName = name
      .toLocaleLowerCase("bg")
      .startsWith(`${designer.name.toLocaleLowerCase("bg")} `)
      ? name.slice(designer.name.length).trim()
      : name
    if (!cleanName) {
      return new StepResponse<Prepared>(
        failure("invalid", "Добавете име на парфюма след дизайнерската къща."),
      )
    }
    const title = `${designer.name} ${cleanName}`
    const isVisible = input.catalog_visible === true
    const metadata = {
      ...(product.metadata || {}),
      listing_type: "full_perfume",
      perfume_name: cleanName,
      catalog_visible: isVisible,
      brand: designer.name,
      gender: genderCode(gender),
      perfume_profile: {
        ...oldProfile,
        designer_id: designer.id,
        concentration,
        gender,
      },
    }
    const decants = await listLinkedDecants(container, product.id)
    const variantMetadata = {
      ...(variant.metadata || {}),
      volume_ml: volumeMl,
    }
    const imageUrl = input.image_url?.trim() || ""

    const updates: UpdatePerfumeProductsInput = {
      products: [
        {
          id: product.id,
          title,
          description: input.description?.trim() ?? product.description,
          thumbnail: imageUrl || product.thumbnail,
          ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
          status: isVisible
            ? ProductStatus.PUBLISHED
            : (product.status as ProductStatus),
          metadata,
        },
        ...decants.map((decant) => ({
          id: decant.id,
          title: `${title} — Отливки`,
          description: input.description?.trim() ?? product.description,
          thumbnail: imageUrl || product.thumbnail,
          ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
          status: isVisible
            ? ProductStatus.PUBLISHED
            : (decant.status as ProductStatus),
          metadata: {
            ...(decant.metadata || {}),
            ...sourceMetadataForDecant(metadata),
            decant_source_volume_ml: volumeMl,
          },
        })),
      ],
    }
    // Product compensation does not snapshot nested variant fields. Keep
    // variant metadata/title and pricing in their own compensated core flow.
    const variantUpdates: UpdateProductVariantsWorkflowInput = {
      product_variants: [
        {
          id: variant.id,
          title: `${volumeMl} ml`,
          metadata: variantMetadata,
          prices: [{ amount: priceEur, currency_code: "eur" }],
        },
      ],
    }
    return new StepResponse<Prepared>({
      updates,
      variant_updates: variantUpdates,
    })
  },
)

export const updateFullPerfumeWorkflow = createWorkflow(
  "update-full-perfume",
  function (input: UpdateFullPerfumeInput) {
    const key = transform({ input }, ({ input }) =>
      [
        decantSourceLock(input.product_id),
        `perfume-settings:${input.product_id}`,
      ].sort(),
    )
    const lock = acquireLockStep({ key, timeout: 10, ttl: 120 })
    const prepared = prepareFullPerfumeUpdateStep(
      transform({ input, lock }, ({ input }) => input),
    )
    const saved = when(
      "save-full-perfume-update",
      { prepared },
      ({ prepared }) => !prepared.error,
    ).then(() => {
      const updated = updatePerfumeProductsWorkflow.runAsStep({
        input: transform({ prepared }, ({ prepared }) => prepared.updates!),
      })
      const updatedVariants = updateProductVariantsWorkflow.runAsStep({
        input: transform(
          { prepared, updated },
          ({ prepared }) => prepared.variant_updates!,
        ),
      })
      const { data } = useQueryGraphStep({
        entity: "product",
        filters: {
          id: transform(
            { updatedVariants, input },
            ({ input }) => input.product_id,
          ),
        },
        fields: perfumeFields,
      })
      return data
    })
    const released = releaseLockStep(
      transform({ saved, prepared, key }, ({ key }) => ({ key })),
    )
    return new WorkflowResponse(
      transform(
        { prepared, saved, released },
        ({ prepared, saved }): UpdateFullPerfumeResult =>
          prepared.error
            ? { error: prepared.error }
            : { product: saved![0] as Product },
      ),
    )
  },
)
