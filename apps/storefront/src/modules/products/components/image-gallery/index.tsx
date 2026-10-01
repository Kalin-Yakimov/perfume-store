import { HttpTypes } from "@medusajs/types"
import { Container } from "@modules/common/components/ui"
import Image from "next/image"
import { canOptimizeImage } from "@lib/util/image-optimization"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
  productTitle: string
}

const ImageGallery = ({ images, productTitle }: ImageGalleryProps) => {
  return (
    <div className="flex items-start relative">
      <div className="mx-auto flex w-full max-w-[460px] flex-col gap-y-4 small:pr-5">
        {images.map((image, index) => {
          return (
            <Container
              key={image.id}
              className="relative aspect-[4/5] w-full overflow-hidden bg-ui-bg-subtle"
              id={image.id}
            >
              {!!image.url && (
                <Image
                  src={image.url}
                  priority={index === 0}
                  unoptimized={!canOptimizeImage(image.url)}
                  className="absolute inset-0 rounded-rounded"
                  alt={`${productTitle} — снимка ${index + 1}`}
                  fill
                  sizes="(max-width: 512px) calc(100vw - 48px), 460px"
                  style={{
                    objectFit: "cover",
                  }}
                />
              )}
            </Container>
          )
        })}
      </div>
    </div>
  )
}

export default ImageGallery
