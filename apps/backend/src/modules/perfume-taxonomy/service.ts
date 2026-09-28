import { MedusaService } from "@medusajs/framework/utils"

import { PerfumeTaxonomy } from "./models/perfume-taxonomy"

class PerfumeTaxonomyModuleService extends MedusaService({
  PerfumeTaxonomy,
}) {}

export default PerfumeTaxonomyModuleService
