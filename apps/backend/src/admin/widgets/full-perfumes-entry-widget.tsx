import { defineWidgetConfig } from "@medusajs/admin-sdk"

const FullPerfumesEntryWidget = () => (
  <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border px-6 py-4">
    <p className="text-sm font-semibold">Добавяте или редактирате парфюм?</p>
    <p className="text-ui-fg-subtle mt-1 text-sm">
      Използвайте раздел „Парфюми“. Там обемът, цената, наличността, ароматният профил и отливките са подредени за вашия магазин.
      Тази обща таблица съдържа и техническите записи за отливките.
    </p>
    <a className="text-ui-fg-interactive mt-2 inline-block text-sm underline" href="/app/full-perfumes">
      Отвори управлението на парфюми →
    </a>
  </section>
)

export const config = defineWidgetConfig({
  id: "perfume-store.full-perfumes-entry",
  zone: "product.list.before",
})

export default FullPerfumesEntryWidget
