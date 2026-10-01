import { Container, clx } from "@modules/common/components/ui"
import Image from "next/image"
import React from "react"
import { canOptimizeImage } from "@lib/util/image-optimization"

import PlaceholderImage from "@modules/common/icons/placeholder-image"

type ThumbnailProps = {
  thumbnail?: string | null
  images?: { url?: string }[] | null
  imageAlt?: string
  size?: "small" | "medium" | "large" | "full" | "catalog" | "square"
  isFeatured?: boolean
  priority?: boolean
  className?: string
  "data-testid"?: string
}

const Thumbnail: React.FC<ThumbnailProps> = ({
  thumbnail,
  images,
  imageAlt,
  size = "small",
  isFeatured,
  priority = false,
  className,
  "data-testid": dataTestid,
}) => {
  const initialImage = thumbnail || images?.[0]?.url

  return (
    <Container
      className={clx(
        "relative w-full overflow-hidden p-4 bg-ui-bg-subtle shadow-elevation-card-rest rounded-large group-hover:shadow-elevation-card-hover transition-shadow ease-in-out duration-150",
        className,
        {
          "aspect-[11/14]": isFeatured,
          "aspect-[9/16]":
            !isFeatured && size !== "square" && size !== "catalog",
          "aspect-[4/5]": !isFeatured && size === "catalog",
          "aspect-[1/1]": size === "square",
          "w-[180px]": size === "small",
          "w-[290px]": size === "medium",
          "w-[440px]": size === "large",
          "w-full": size === "full",
        },
      )}
      data-testid={dataTestid}
    >
      <ImageOrPlaceholder
        image={initialImage}
        size={size}
        alt={imageAlt}
        priority={priority}
      />
    </Container>
  )
}

const ImageOrPlaceholder = ({
  image,
  size,
  alt,
  priority,
}: Pick<ThumbnailProps, "size" | "priority"> & { image?: string; alt?: string }) => {
  const imageSizes = {
    small: "180px",
    medium: "290px",
    large: "440px",
    full: "(max-width: 640px) 92vw, 460px",
    catalog: "(max-width: 639px) 46vw, 22vw",
    square: "96px",
  }[size || "small"]

  return image ? (
    <Image
      src={image}
      alt={alt || "Изображение на продукт"}
      className="absolute inset-0 object-cover object-center"
      draggable={false}
      unoptimized={!canOptimizeImage(image)}
      quality={60}
      priority={priority}
      sizes={imageSizes}
      fill
    />
  ) : (
    <div className="w-full h-full absolute inset-0 flex items-center justify-center">
      <PlaceholderImage size={size === "small" ? 16 : 24} />
    </div>
  )
}

export default Thumbnail
