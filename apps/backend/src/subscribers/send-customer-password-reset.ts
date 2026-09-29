import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { SubscriberArgs, type SubscriberConfig } from "@medusajs/medusa"

type PasswordResetRequestedData = {
  entity_id: string
  token: string
  actor_type: string
}

export default async function sendCustomerPasswordReset({
  event: { data },
  container,
}: SubscriberArgs<PasswordResetRequestedData>) {
  if (data.actor_type !== "customer") {
    return
  }

  const notificationService = container.resolve(Modules.NOTIFICATION)
  const config = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE)
  const storefrontUrl = config.admin.storefrontUrl || "http://localhost:8000"
  const resetUrl = new URL("/nova-parola", storefrontUrl)
  resetUrl.searchParams.set("token", data.token)
  resetUrl.searchParams.set("email", data.entity_id)

  await notificationService.createNotifications({
    to: data.entity_id,
    channel: "email",
    template: "password-reset",
    data: {
      email: data.entity_id,
      reset_url: resetUrl.toString(),
    },
  })
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
}
