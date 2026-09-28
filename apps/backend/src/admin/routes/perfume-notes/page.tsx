import { defineRouteConfig } from "@medusajs/admin-sdk"

import PerfumeTaxonomyManager from "../../components/perfume-taxonomy-manager"

const PerfumeNotesPage = () => (
  <PerfumeTaxonomyManager
    kind="note"
    title="Парфюмни нотки"
    description="Пазете българското и оригиналното английско име заедно със собствено качена снимка."
  />
)

export const config = defineRouteConfig({
  label: "Парфюмни нотки",
})

export default PerfumeNotesPage
