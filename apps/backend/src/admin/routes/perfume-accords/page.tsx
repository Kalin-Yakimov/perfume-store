import { defineRouteConfig } from "@medusajs/admin-sdk"

import PerfumeTaxonomyManager from "../../components/perfume-taxonomy-manager"

const PerfumeAccordsPage = () => (
  <PerfumeTaxonomyManager
    kind="accord"
    title="Основни акорди"
    description="Вътрешен каталог с преизползваеми акорди. Те се показват като обикновен текст в продуктовата страница и не водят към отделни публични страници."
  />
)

export const config = defineRouteConfig({
  label: "Основни акорди",
})

export default PerfumeAccordsPage
