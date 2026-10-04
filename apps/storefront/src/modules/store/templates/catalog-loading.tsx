import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"

export default function CatalogLoading() {
  return (
    <div
      className="content-container py-8 small:py-12"
      role="status"
      aria-busy="true"
    >
      <p className="mb-6 text-sm text-[#74695f]">Зареждане на каталога…</p>
      <div className="flex flex-col gap-7 small:flex-row small:gap-8">
        <div
          className="hidden h-96 w-56 shrink-0 animate-pulse border border-[#ded7cf] bg-[#eee8df] small:block"
          aria-hidden="true"
        />
        <div className="w-full">
          <SkeletonProductGrid />
        </div>
      </div>
    </div>
  )
}
