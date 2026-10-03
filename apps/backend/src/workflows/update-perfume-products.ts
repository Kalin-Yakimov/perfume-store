import type { IProductModuleService } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import type { UpdateProductWorkflowInput } from "@medusajs/medusa/core-flows"
import {
  updateProductsWorkflow,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"

export type UpdatePerfumeProductsInput = Extract<
  UpdateProductWorkflowInput,
  { products: unknown }
>

type ProductImages = {
  id: string
  images: {
    id: string
    url: string
    rank: number
    metadata: Record<string, unknown> | null
    variant_ids: string[]
  }[]
}

// The core batch update snapshots options but omits image relations. Register
// this safeguard first so it restores image data and explicit variant
// assignments after core compensation.
const preserveProductImagesStep = createStep(
  "preserve-product-images",
  async (products: ProductImages[]) =>
    new StepResponse(
      products.map((product) => product.id),
      products,
    ),
  async (products, { container }) => {
    if (!products?.length) return
    const productModule = container.resolve<IProductModuleService>(
      Modules.PRODUCT,
    )
    await productModule.upsertProducts(
      products.map((product) => ({
        id: product.id,
        images: product.images.map((image) => ({
          id: image.id,
          url: image.url,
          rank: image.rank,
          metadata: image.metadata,
        })),
      })),
    )
    const imageIds = products.flatMap((product) =>
      product.images.map((image) => image.id),
    )
    if (!imageIds.length) return
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: restored } = await query.graph({
      entity: "product_image",
      filters: { id: imageIds },
      fields: ["id", "variants.id"],
    })
    const existing = new Set(
      restored.flatMap((image) =>
        (image.variants || []).flatMap((variant) =>
          variant ? [`${image.id}:${variant.id}`] : [],
        ),
      ),
    )
    // A failure before the core image mutation leaves original pairs intact.
    // Recreate only missing explicit assignments so compensation is retryable.
    const missing = products.flatMap((product) =>
      product.images.flatMap((image) =>
        image.variant_ids.flatMap((variantId) =>
          existing.has(`${image.id}:${variantId}`)
            ? []
            : [{ image_id: image.id, variant_id: variantId }],
        ),
      ),
    )
    if (missing.length) await productModule.addImageToVariant(missing)
  },
)

export const updatePerfumeProductsWorkflow = createWorkflow(
  "update-perfume-products",
  function (input: UpdatePerfumeProductsInput) {
    const { data: before } = useQueryGraphStep({
      entity: "product",
      filters: {
        id: transform({ input }, ({ input }) =>
          input.products.flatMap((product) => (product.id ? [product.id] : [])),
        ),
      },
      fields: [
        "id",
        "images.id",
        "images.url",
        "images.rank",
        "images.metadata",
        "images.variants.id",
      ],
    })
    const preserved = preserveProductImagesStep(
      transform({ before }, ({ before }) =>
        before.map((product) => ({
          id: product.id,
          images: (product.images || []).flatMap((image) =>
            image
              ? [
                  {
                    id: image.id,
                    url: image.url,
                    rank: image.rank,
                    metadata: image.metadata ?? null,
                    variant_ids: (image.variants || []).flatMap((variant) =>
                      variant ? [variant.id] : [],
                    ),
                  },
                ]
              : [],
          ),
        })),
      ),
    )
    const updated = updateProductsWorkflow.runAsStep({
      input: transform({ input, preserved }, ({ input }) => input),
    })
    return new WorkflowResponse(updated)
  },
)
