import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import { SubscriberArgs, type SubscriberConfig } from "@medusajs/medusa"

type VerificationRequestedData = {
  entity_id: string
  entity_type: string
  code: string
}

export default async function sendCustomerEmailVerification({
  event: { data },
  container,
}: SubscriberArgs<VerificationRequestedData>) {
  if (data.entity_type !== "email") {
    return
  }

  const notificationService = container.resolve(Modules.NOTIFICATION)
  const config = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE)
  const storefrontUrl = config.admin.storefrontUrl || "http://localhost:8000"
  const verificationUrl = new URL("/potvardi-profil", storefrontUrl)
  verificationUrl.searchParams.set("token", data.code)
  verificationUrl.searchParams.set("email", data.entity_id)

  await notificationService.createNotifications({
    to: data.entity_id,
    channel: "email",
    template: "email-verification",
    data: {
      email: data.entity_id,
      verification_url: verificationUrl.toString(),
    },
  })
}

export const config: SubscriberConfig = {
  event: "auth.verification_requested",
}
