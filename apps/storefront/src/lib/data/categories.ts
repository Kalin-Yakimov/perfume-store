import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getPublicCacheOptions } from "./cache-policy"

export const listCategories = async (query?: Record<string, unknown>) => {
  const cacheOptions = getPublicCacheOptions("categories")

  const limit = query?.limit || 100

  return sdk.client
    .fetch<{ product_categories: HttpTypes.StoreProductCategory[] }>(
      "/store/product-categories",
      {
        query: {
          fields:
            "*category_children, *products, *parent_category, *parent_category.parent_category",
          limit,
          ...query,
        },
        ...cacheOptions,
      }
    )
    .then(({ product_categories }) => product_categories)
}

export const getCategoryByHandle = async (categoryHandle: string[]) => {
  const handle = `${categoryHandle.join("/")}`

  const cacheOptions = getPublicCacheOptions("categories")

  return sdk.client
    .fetch<HttpTypes.StoreProductCategoryListResponse>(
      `/store/product-categories`,
      {
        query: {
          fields: "*category_children, *products",
          handle,
        },
        ...cacheOptions,
      }
    )
    .then(({ product_categories }) => product_categories[0])
}
