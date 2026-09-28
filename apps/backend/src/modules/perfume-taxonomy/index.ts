import { Module } from "@medusajs/framework/utils"

import PerfumeTaxonomyModuleService from "./service"

export const PERFUME_TAXONOMY_MODULE = "perfumeTaxonomy"

export default Module(PERFUME_TAXONOMY_MODULE, {
  service: PerfumeTaxonomyModuleService,
})
