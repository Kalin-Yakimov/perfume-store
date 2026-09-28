const SkeletonRelatedProducts = () => (
  <section
    className="content-container border-t border-[#ded7cf] pb-10 pt-7 small:pb-14 small:pt-9"
    aria-hidden="true"
  >
    <div className="mb-6 space-y-3">
      <div className="h-3 w-24 animate-pulse bg-[#eee8df]" />
      <div className="h-7 w-64 animate-pulse bg-[#eee8df]" />
    </div>
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="w-[78%] shrink-0 border border-[#ded7cf] bg-[#fffdf9] p-3 xsmall:w-[calc((100%-16px)/2)] small:w-[calc((100%-64px)/5)]"
        >
          <div className="aspect-[4/5] animate-pulse bg-[#eee8df]" />
          <div className="mt-3 h-3 w-2/5 animate-pulse bg-[#eee8df]" />
          <div className="mt-2 h-4 w-4/5 animate-pulse bg-[#eee8df]" />
          <div className="mt-4 h-4 w-1/3 animate-pulse bg-[#eee8df]" />
        </div>
      ))}
    </div>
  </section>
)

export default SkeletonRelatedProducts
