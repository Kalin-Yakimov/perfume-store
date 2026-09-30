import { Metadata } from "next"
import { notFound } from "next/navigation"
import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { isProductVisibleInCatalog } from "@lib/util/perfume-filters"
import { formatProductTitle } from "@lib/util/format-volume-for-display"
import ProductTemplate from "@modules/products/templates"
import { HttpTypes } from "@medusajs/types"

type Props = {
  params: Promise<{ countryCode: string; handle: string }>
  searchParams: Promise<{ v_id?: string }>
}

export const dynamicParams = true

export async function generateStaticParams() {
  // Products and stock change in the admin; resolve product pages on demand
  // instead of snapshotting the catalog during a frontend build.
  return []
}

function getImagesForVariant(
  product: HttpTypes.StoreProduct,
  selectedVariantId?: string,
) {
  if (!selectedVariantId || !product.variants) {
    return product.images
  }

  const variant = product.variants!.find((v) => v.id === selectedVariantId)
  if (!variant || !variant.images?.length) {
    return product.images
  }

  const imageIdsMap = new Map(variant.images!.map((i) => [i.id, true]))
  return product.images?.filter((i) => imageIdsMap.has(i.id)) ?? null
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const { handle } = params
  const region = await getRegion(params.countryCode)

  if (!region) {
    notFound()
  }

  const product = await listProducts({
    countryCode: params.countryCode,
    queryParams: { handle },
  }).then(({ response }) => response.products[0])

  if (!product) {
    notFound()
  }

  if (!isProductVisibleInCatalog(product)) {
    notFound()
  }

  const title = formatProductTitle(
    product.title,
    product.metadata?.listing_type === "decant",
  )
  const brand =
    typeof product.metadata?.brand === "string"
      ? product.metadata.brand
      : typeof product.metadata?.designer === "string"
        ? product.metadata.designer
        : undefined
  const fullDescription =
    product.description?.replace(/\s+/g, " ").trim() ||
    [brand, title, "Разгледайте подробности и налични разфасовки."]
      .filter(Boolean)
      .join(" · ")
  const description =
    fullDescription.length > 160
      ? `${fullDescription.slice(0, 157).trimEnd()}...`
      : fullDescription

  return {
    title,
    description,
    alternates: { canonical: `/products/${product.handle}` },
    openGraph: {
      type: "website",
      title: `${title} | Parfumerie`,
      description,
      images: product.thumbnail ? [product.thumbnail] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Parfumerie`,
      description,
      images: product.thumbnail ? [product.thumbnail] : [],
    },
  }
}

export default async function ProductPage(props: Props) {
  const params = await props.params
  const region = await getRegion(params.countryCode)
  const searchParams = await props.searchParams

  const selectedVariantId = searchParams.v_id

  if (!region) {
    notFound()
  }

  const pricedProduct = await listProducts({
    countryCode: params.countryCode,
    queryParams: { handle: params.handle },
  }).then(({ response }) => response.products[0])

  if (!pricedProduct) {
    notFound()
  }

  if (!isProductVisibleInCatalog(pricedProduct)) {
    notFound()
  }

  const sourceProductId = pricedProduct.metadata?.decant_source_product_id
  const profileProduct =
    typeof sourceProductId === "string"
      ? await listProducts({
          countryCode: params.countryCode,
          queryParams: { id: [sourceProductId] },
        }).then(({ response }) => response.products[0] || pricedProduct)
      : pricedProduct
  const linkedDecants =
    pricedProduct.metadata?.listing_type === "decant"
      ? []
      : await listProducts({
          countryCode: params.countryCode,
          queryParams: { limit: 100 },
        }).then(({ response }) =>
          response.products.filter(
            (product) =>
              product.metadata?.listing_type === "decant" &&
              product.metadata?.decant_source_product_id === pricedProduct.id &&
              isProductVisibleInCatalog(product),
          ),
        )

  const images = getImagesForVariant(pricedProduct, selectedVariantId)

  return (
    <ProductTemplate
      product={pricedProduct}
      region={region}
      countryCode={params.countryCode}
      images={images ?? []}
      profileProduct={profileProduct}
      linkedDecants={linkedDecants}
    />
  )
}
