import { HttpTypes } from "@medusajs/types"
import { listPerfumeTaxonomies } from "@lib/data/perfume-taxonomies"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import PerfumeProfileDetails from "@modules/products/components/perfume-profile"
import ProductActions from "@modules/products/components/product-actions"
import ImageGallery from "@modules/products/components/image-gallery"
import RelatedProducts from "@modules/products/components/related-products"
import WishlistButton from "@modules/products/components/wishlist-button"
import { getPerfumeProfile } from "@modules/products/data/perfume-profiles"
import { formatProductTitle } from "@lib/util/format-volume-for-display"
import { getProductPrice } from "@lib/util/get-product-price"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import ProductActionsWrapper from "./product-actions-wrapper"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images: HttpTypes.StoreProductImage[]
  profileProduct?: HttpTypes.StoreProduct
  linkedDecants?: HttpTypes.StoreProduct[]
}

const ProductTemplate = async ({
  product,
  region,
  countryCode,
  images,
  profileProduct = product,
  linkedDecants = [],
}: ProductTemplateProps) => {
  if (!product || !product.id) {
    return notFound()
  }

  const taxonomyItems = await listPerfumeTaxonomies()
  const profile = getPerfumeProfile(
    profileProduct.handle,
    profileProduct.metadata,
    taxonomyItems,
  )
  const metadataBrand = profileProduct.metadata?.brand
  const brand =
    profile?.brand ??
    (typeof metadataBrand === "string" ? metadataBrand : "Parfumerie")
  const description = profile?.tagline || product.description
  const isDecant = product.metadata?.listing_type === "decant"
  const pricedVariant = product.variants
    ?.filter((variant) => variant.calculated_price)
    .sort(
      (a, b) =>
        (a.calculated_price?.calculated_amount ?? 0) -
        (b.calculated_price?.calculated_amount ?? 0),
    )[0] || product.variants?.[0]
  const storedVolume = Number(pricedVariant?.metadata?.volume_ml)
  const optionText = pricedVariant?.options?.map((option) => option.value).join(" ") || ""
  const volumeMatch = `${pricedVariant?.title || ""} ${optionText}`.match(
    /(\d+(?:[.,]\d+)?)\s*(?:ml|мл)/i,
  )
  const volume =
    Number.isFinite(storedVolume) && storedVolume > 0
      ? `${storedVolume} мл`
      : volumeMatch
        ? `${volumeMatch[1]} мл`
        : ""
  const price = getProductPrice({ product }).cheapestPrice?.calculated_price
  const inventoryVariants = product.variants || []
  const availability = isDecant
    ? "unknown"
    : inventoryVariants.some(
          (variant) =>
            !variant.manage_inventory ||
            variant.allow_backorder ||
            (variant.inventory_quantity || 0) > 0,
        )
      ? "available"
      : "unavailable"
  const designer = taxonomyItems.find(
    (item) =>
      item.kind === "designer" &&
      item.name.toLocaleLowerCase() === brand.toLocaleLowerCase(),
  )
  const perfumeNotes = taxonomyItems.filter((item) => item.kind === "note")

  return (
    <main className="bg-[#fbf9f6]">
      <section
        className="content-container grid gap-7 py-7 small:grid-cols-[1.05fr_0.95fr] small:items-start small:gap-10 small:py-10"
        data-testid="product-container"
      >
        <div className="min-w-0">
          <ImageGallery images={images} />
        </div>

        <div>
          {designer ? (
            <LocalizedClientLink
              href={`/dizaynerski-kashti/${designer.slug}`}
              className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#806e60] underline-offset-4 transition hover:underline"
            >
              {brand}
            </LocalizedClientLink>
          ) : (
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#806e60]">
              {brand}
            </p>
          )}
          <div className="mt-3 flex items-start justify-between gap-6">
            <h1
              className="font-display text-3xl leading-tight tracking-[-0.03em] small:text-4xl"
              data-testid="product-title"
            >
              {formatProductTitle(
                product.title,
                product.metadata?.listing_type === "decant",
              )}
            </h1>
            <WishlistButton
              item={{
                id: product.id,
                handle: product.handle ?? product.id,
                title: formatProductTitle(
                  product.title,
                  isDecant,
                ),
                thumbnail: product.thumbnail,
                brand,
                concentration: profile?.concentration || "",
                gender:
                  profile?.gender === "Мъжки"
                    ? "за мъже"
                    : profile?.gender === "Женски"
                      ? "за жени"
                      : profile?.gender === "Унисекс"
                        ? "унисекс"
                        : "",
                volume,
                price,
                availability,
                listingType: isDecant ? "decant" : "full_perfume",
              }}
            />
          </div>

          {profile?.concentration && (
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#8b796b]">
              {profile.concentration}
            </p>
          )}

          {description && (
            <p
              className="mt-4 max-w-xl text-sm leading-6 text-[#62584f]"
              data-testid="product-description"
            >
              {description}
            </p>
          )}

          <div className="mt-6 border-t border-[#ded7cf] pt-6">
            {profileProduct.id !== product.id && profileProduct.handle && (
              <LocalizedClientLink
                href={`/products/${profileProduct.handle}`}
                className="mb-6 inline-flex w-fit items-center rounded-md border border-[#2a241f] bg-[#f0e9e1] px-4 py-2.5 text-base font-bold !text-[#211d19] shadow-sm transition hover:bg-[#e7ddd2] hover:!text-[#211d19] visited:!text-[#211d19] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a241f]"
              >
                Виж цялата бутилка
              </LocalizedClientLink>
            )}

            {profileProduct.id === product.id && linkedDecants.length > 0 && (
              <LocalizedClientLink
                href={`/products/${linkedDecants[0].handle}`}
                className="mb-6 inline-flex w-fit items-center rounded-md border border-[#2a241f] bg-[#f0e9e1] px-4 py-2.5 text-base font-bold !text-[#211d19] shadow-sm transition hover:bg-[#e7ddd2] hover:!text-[#211d19] visited:!text-[#211d19] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a241f]"
              >
                {linkedDecants.length === 1
                  ? "Предлага се и като отливка"
                  : "Виж отливките за този парфюм"}
              </LocalizedClientLink>
            )}

            <Suspense
              fallback={
                <ProductActions
                  disabled={true}
                  product={product}
                  region={region}
                />
              }
            >
              <ProductActionsWrapper id={product.id} region={region} />
            </Suspense>
          </div>

          <div className="mt-6 grid gap-3 border-y border-[#ded7cf] py-4 text-xs text-[#6f645a] xsmall:grid-cols-3">
            <div>
              <span className="font-semibold text-[#332d28]">
                Проверен произход
              </span>
              <p className="mt-1">Подбран продукт</p>
            </div>
            <div>
              <span className="font-semibold text-[#332d28]">Доставка</span>
              <p className="mt-1">До 2–4 работни дни</p>
            </div>
            <div>
              <span className="font-semibold text-[#332d28]">Консултация</span>
              <p className="mt-1">Помощ при избора</p>
            </div>
          </div>
        </div>
      </section>

      {profile && (
        <PerfumeProfileDetails profile={profile} perfumeNotes={perfumeNotes} />
      )}

      <Suspense fallback={<SkeletonRelatedProducts />}>
        <RelatedProducts
          product={product}
          profileProduct={profileProduct}
          region={region}
          countryCode={countryCode}
          taxonomyItems={taxonomyItems}
        />
      </Suspense>
    </main>
  )
}

export default ProductTemplate
