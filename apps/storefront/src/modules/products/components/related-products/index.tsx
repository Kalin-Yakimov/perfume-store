import { listAllProducts } from "@lib/data/products"
import { PerfumeTaxonomyItem } from "@lib/data/perfume-taxonomies"
import { filterPerfumeProducts } from "@lib/util/perfume-filters"
import { isBottleAvailable } from "@lib/util/product-stock"
import { HttpTypes } from "@medusajs/types"
import {
  getPerfumeProfile,
  PerfumeProfile,
} from "@modules/products/data/perfume-profiles"
import ProductPreview from "../product-preview"

import RelatedProductsCarousel from "./related-products-carousel"

type RelatedProductsProps = {
  product: HttpTypes.StoreProduct
  profileProduct: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  taxonomyItems: PerfumeTaxonomyItem[]
}

const normalize = (value: string) =>
  value.normalize("NFC").trim().toLocaleLowerCase("bg")

const sharedCount = (first: string[], second: string[]) => {
  const values = new Set(first.map(normalize))
  return Array.from(new Set(second.map(normalize))).filter((value) =>
    values.has(value),
  ).length
}

const allNotes = (profile: PerfumeProfile | undefined) =>
  profile
    ? [...profile.notes.top, ...profile.notes.heart, ...profile.notes.base]
    : []

const brandOf = (
  product: HttpTypes.StoreProduct,
  profile: PerfumeProfile | undefined,
) => {
  const metadataBrand = product.metadata?.brand
  return (
    profile?.brand ||
    (typeof metadataBrand === "string" ? metadataBrand : "") ||
    product.collection?.title ||
    ""
  )
}

const similarityScore = (
  current: PerfumeProfile | undefined,
  candidate: PerfumeProfile | undefined,
  currentBrand: string,
  candidateBrand: string,
) => {
  const sharedNotes = sharedCount(allNotes(current), allNotes(candidate))
  const sharedAccords = sharedCount(
    current?.accords || [],
    candidate?.accords || [],
  )
  const sharedSeasons = sharedCount(
    current?.seasons || [],
    candidate?.seasons || [],
  )
  const gender =
    current?.gender && candidate?.gender
      ? current.gender === candidate.gender
        ? 2
        : current.gender === "Унисекс" || candidate.gender === "Унисекс"
          ? 1
          : 0
      : 0
  const sameBrand =
    currentBrand &&
    candidateBrand &&
    normalize(currentBrand) === normalize(candidateBrand)
      ? 1
      : 0

  // Notes define the scent most strongly; accords come next. Gender,
  // seasons and brand only decide between otherwise similar perfumes.
  return (
    sharedNotes * 6 + sharedAccords * 3 + gender + sharedSeasons + sameBrand
  )
}

export default async function RelatedProducts({
  product,
  profileProduct,
  region,
  countryCode,
  taxonomyItems,
}: RelatedProductsProps) {
  const products = await listAllProducts({
    countryCode,
    queryParams: { is_giftcard: false },
  })
  const currentProfile = getPerfumeProfile(
    profileProduct.handle,
    profileProduct.metadata,
    taxonomyItems,
  )
  const currentBrand = brandOf(profileProduct, currentProfile)

  const recommendations = filterPerfumeProducts(
    products,
    undefined,
    "full_perfume",
  )
    .filter(
      (candidate) =>
        candidate.id !== product.id &&
        candidate.id !== profileProduct.id &&
        Boolean(candidate.handle),
    )
    .map((candidate) => {
      const candidateProfile = getPerfumeProfile(
        candidate.handle,
        candidate.metadata,
        taxonomyItems,
      )

      return {
        product: candidate,
        unavailable: !isBottleAvailable(candidate),
        scentMatch:
          sharedCount(allNotes(currentProfile), allNotes(candidateProfile)) >
            0 ||
          sharedCount(
            currentProfile?.accords || [],
            candidateProfile?.accords || [],
          ) > 0,
        score: similarityScore(
          currentProfile,
          candidateProfile,
          currentBrand,
          brandOf(candidate, candidateProfile),
        ),
      }
    })
    .sort(
      (a, b) =>
        Number(a.unavailable) - Number(b.unavailable) ||
        b.score - a.score ||
        String(b.product.created_at || "").localeCompare(
          String(a.product.created_at || ""),
        ) ||
        a.product.id.localeCompare(b.product.id),
    )
    .slice(0, 12)

  if (!recommendations.length) {
    return null
  }

  return (
    <section
      className="content-container border-t border-[#ded7cf] pb-10 pt-7 small:pb-14 small:pt-9"
      data-testid="related-products-container"
    >
      <RelatedProductsCarousel
        hasSimilarProducts={recommendations[0].scentMatch}
      >
        {recommendations.map(({ product: recommendation, unavailable }) => (
          <ProductPreview
            key={recommendation.id}
            product={recommendation}
            region={region}
            compact
            unavailable={unavailable}
          />
        ))}
      </RelatedProductsCarousel>
    </section>
  )
}
