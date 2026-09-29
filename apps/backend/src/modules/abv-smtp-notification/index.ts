import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import AbvSmtpNotificationService from "./service"

export default ModuleProvider(Modules.NOTIFICATION, {
  services: [AbvSmtpNotificationService],
})
