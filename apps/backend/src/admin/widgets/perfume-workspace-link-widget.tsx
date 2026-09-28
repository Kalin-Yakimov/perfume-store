import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect, useState } from "react"
import { useLocation, useParams } from "react-router-dom"

import { adminRequest } from "../components/perfume-taxonomy-manager"

type Product = {
  id: string
  metadata: Record<string, unknown> | null
}

const PerfumeWorkspaceLinkWidget = () => {
  const params = useParams<{ id?: string; product_id?: string }>()
  const location = useLocation()
  const [product, setProduct] = useState<Product | null>(null)
  const productId = params.id || params.product_id || location.pathname.split("/").filter(Boolean).at(-1)

  useEffect(() => {
    if (!productId) return
    let active = true
    void adminRequest<{ product: Product }>(`/admin/products/${productId}?fields=id,metadata`)
      .then(({ product: loaded }) => {
        if (active) setProduct(loaded)
      })
      .catch(() => {
        if (active) setProduct(null)
      })
    return () => { active = false }
  }, [productId])

  if (!product) return null
  const sourceId = product.metadata?.decant_source_product_id
  const isDecant = product.metadata?.listing_type === "decant"
  const isPerfume = product.metadata?.listing_type === "full_perfume" ||
    typeof product.metadata?.brand === "string" ||
    (typeof product.metadata?.perfume_profile === "object" && product.metadata.perfume_profile !== null)
  if (!isPerfume && !isDecant) return null

  const hasSource = typeof sourceId === "string" && sourceId.length > 0
  const targetId = isDecant && hasSource ? sourceId : product.id
  const targetUrl = isDecant && !hasSource
    ? "/app/full-perfumes"
    : `/app/full-perfumes/${targetId}`
  return (
    <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border px-6 py-4">
      <h2 className="text-sm font-semibold">
        {isDecant ? "Технически запис за отливки" : "Управление на парфюма"}
      </h2>
      <p className="text-ui-fg-subtle mt-1 text-sm">
        {isDecant
          ? "Отливките се настройват от оригиналния цял парфюм. Не ги редактирайте като отделна обява."
          : "Основните данни, наличността, ароматният профил и отливките са събрани на едно място."}
      </p>
      <a className="text-ui-fg-interactive mt-2 inline-block text-sm underline" href={targetUrl}>
        {isDecant && !hasSource
          ? "Към списъка с парфюми →"
          : isDecant
            ? "Отвори оригиналния парфюм →"
            : "Отвори управлението на парфюма →"}
      </a>
    </section>
  )
}

export const config = defineWidgetConfig({
  id: "perfume-store.perfume-workspace-link",
  zone: "product.details.after",
})

export default PerfumeWorkspaceLinkWidget
