import { Module } from "@medusajs/framework/utils"

import DecantStockModuleService from "./service"

export const DECANT_STOCK_MODULE = "decantStock"

export const DECANT_RESERVE_ML = 5

export default Module(DECANT_STOCK_MODULE, {
  service: DecantStockModuleService,
})
