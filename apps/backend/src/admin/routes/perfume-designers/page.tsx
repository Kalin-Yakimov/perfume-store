import { defineRouteConfig } from "@medusajs/admin-sdk"

import PerfumeTaxonomyManager from "../../components/perfume-taxonomy-manager"

const PerfumeDesignersPage = () => (
  <PerfumeTaxonomyManager
    kind="designer"
    title="Дизайнерски къщи"
    description="Добавяйте имената и локално качените лога на марките, чиито парфюми предлагате."
  />
)

export const config = defineRouteConfig({
  label: "Дизайнерски къщи",
})

export default PerfumeDesignersPage
