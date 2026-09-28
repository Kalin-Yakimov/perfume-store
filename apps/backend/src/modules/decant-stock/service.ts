import { MedusaService } from "@medusajs/framework/utils"

import { DecantAdjustment } from "./models/decant-adjustment"
import { DecantAllocation } from "./models/decant-allocation"
import { DecantBottle } from "./models/decant-bottle"
import { DecantPlannedBottle } from "./models/decant-planned-bottle"

class DecantStockModuleService extends MedusaService({
  DecantBottle,
  DecantAdjustment,
  DecantPlannedBottle,
  DecantAllocation,
}) {}

export default DecantStockModuleService
