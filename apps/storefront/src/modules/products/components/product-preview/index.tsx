import { getProductPrice } from "@lib/util/get-product-price"
import { formatProductTitle } from "@lib/util/format-volume-for-display"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import WishlistButton from "@modules/products/components/wishlist-button"
import Thumbnail from "../thumbnail"
import PreviewPrice from "./price"

type PerfumeProfileMetadata = {
  concentration?: unknown
  gender?: unknown
}

const readProfileMetadata = (
  metadata: Record<string, unknown> | null | undefined,
) => {
  const profile = metadata?.perfume_profile
  return profile && typeof profile === "object" && !Array.isArray(profile)
    ? (profile as PerfumeProfileMetadata)
    : {}
}

const concentrationLabel = (value: unknown) => {
  if (value === "Eau de Parfum") return "Парфюмна вода"
  if (value === "Eau de Toilette") return "Тоалетна вода"
  if (value === "Eau de Cologne") return "Одеколон"
  if (value === "Parfum / Extrait de Parfum") return "Парфюмен екстракт"
  return typeof value === "string" ? value : ""
}

const genderLabel = (value: unknown) => {
  if (value === "male" || value === "Мъжки") return "за мъже"
  if (value === "female" || value === "Женски") return "за жени"
  if (value === "unisex" || value === "Унисекс") return "унисекс"
  return ""
}

const volumeLabel = (
  product: HttpTypes.StoreProduct,
  variant = product.variants?.[0],
) => {
  const storedVolume = Number(variant?.metadata?.volume_ml)
  if (Number.isFinite(storedVolume) && storedVolume > 0) {
    return `${storedVolume} мл`
  }
  const optionText =
    variant?.options?.map((option) => option.value).join(" ") || ""
  const match = `${variant?.title || ""} ${optionText}`.match(
    /(\d+(?:[.,]\d+)?)\s*ml/i,
  )
  return match ? `${match[1]} мл` : ""
}

export default async function ProductPreview({
  product,
  isFeatured,
  compact = false,
  unavailable = false,
  priority = false,
  region: _region,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  compact?: boolean
  unavailable?: boolean
  priority?: boolean
  region: HttpTypes.StoreRegion
}) {
  // const pricedProduct = await listProducts({
  //   regionId: region.id,
  //   queryParams: { id: [product.id!] },
  // }).then(({ response }) => response.products[0])

  // if (!pricedProduct) {
  //   return null
  // }

  const { cheapestPrice } = getProductPrice({
    product,
  })
  const cardVariant =
    product.variants
      ?.filter((variant) => variant.calculated_price)
      .sort(
        (a, b) =>
          (a.calculated_price?.calculated_amount ?? 0) -
          (b.calculated_price?.calculated_amount ?? 0),
      )[0] || product.variants?.[0]
  const metadata = product.metadata as Record<string, unknown> | null
  const profile = readProfileMetadata(metadata)
  const brand = typeof metadata?.brand === "string" ? metadata.brand : ""
  const titleWithoutBrand =
    brand &&
    product.title.toLocaleLowerCase().startsWith(brand.toLocaleLowerCase())
      ? product.title.slice(brand.length).trim()
      : product.title
  const productDetails = [
    concentrationLabel(profile.concentration) ||
      (metadata?.demo === true ? "Парфюмна вода" : ""),
    genderLabel(profile.gender || metadata?.gender),
    volumeLabel(product, cardVariant),
  ].filter(Boolean)

  return (
    <div className="relative h-full">
      <LocalizedClientLink
        href={`/products/${product.handle}`}
        className={`group block h-full ${unavailable ? "text-[#817a73]" : ""}`}
      >
        <div data-testid="product-wrapper">
          <div className="relative">
            <Thumbnail
              thumbnail={product.thumbnail}
              images={product.images}
              imageAlt={formatProductTitle(
                [brand, titleWithoutBrand].filter(Boolean).join(" "),
                product.metadata?.listing_type === "decant",
              )}
              size="catalog"
              isFeatured={isFeatured}
              priority={priority}
              className={unavailable ? "grayscale opacity-65" : undefined}
            />
            {unavailable && (
              <span className="absolute bottom-3 left-3 bg-[#49443f] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                Изчерпан
              </span>
            )}
          </div>
          <div
            className={compact ? "mt-2 min-h-[88px]" : "mt-3 min-h-[104px]"}
          >
            {brand && (
              <p
                className={`${compact ? "text-xs" : "text-sm"} font-medium leading-5 ${unavailable ? "text-[#8c857e]" : "text-[#665c54]"}`}
                data-testid="product-brand"
              >
                {brand}
              </p>
            )}
            <p
              className={`mt-0.5 line-clamp-2 font-semibold ${unavailable ? "text-[#716b65]" : "text-[#302a25]"} ${compact ? "text-sm leading-5" : "text-base leading-6"}`}
              data-testid="product-title"
            >
              {formatProductTitle(
                titleWithoutBrand,
                product.metadata?.listing_type === "decant",
              )}
            </p>
            {!!productDetails.length && (
              <p
                className={`mt-1 line-clamp-2 leading-5 ${unavailable ? "text-[#938c84]" : "text-[#665c54]"} ${compact ? "text-xs" : "text-sm"}`}
              >
                {productDetails.join(" · ")}
              </p>
            )}
          </div>
          <div
            className={`border-t border-[#e5ded6] pt-2 font-bold ${unavailable ? "text-[#817a73]" : "text-[#302a25]"} ${compact ? "text-sm" : "text-base"}`}
          >
            {unavailable ? (
              <span className="text-xs font-semibold uppercase tracking-[0.1em]">
                Няма наличност
              </span>
            ) : (
              cheapestPrice && <PreviewPrice price={cheapestPrice} />
            )}
          </div>
        </div>
      </LocalizedClientLink>
      <WishlistButton
        item={{
          id: product.id,
          handle: product.handle ?? product.id,
          title: formatProductTitle(
            product.title,
            product.metadata?.listing_type === "decant",
          ),
          thumbnail: product.thumbnail,
          brand,
          concentration:
            concentrationLabel(profile.concentration) ||
            (metadata?.demo === true ? "Парфюмна вода" : ""),
          gender: genderLabel(profile.gender || metadata?.gender),
          volume: volumeLabel(product, cardVariant),
          price: cheapestPrice?.calculated_price,
          availability: unavailable ? "unavailable" : "available",
          listingType:
            product.metadata?.listing_type === "decant"
              ? "decant"
              : "full_perfume",
        }}
        className="!h-10 !w-10 absolute right-3 top-3 z-10 shadow-sm"
      />
    </div>
  )
}
