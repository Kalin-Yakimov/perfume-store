import {
  Logger,
  NotificationTypes,
} from "@medusajs/framework/types"
import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils"
import nodemailer, { Transporter } from "nodemailer"

type InjectedDependencies = {
  logger: Logger
}

type ProviderOptions = {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }
    return entities[character]
  })

const emailLayout = (title: string, message: string, link: string, action: string) => {
  const safeTitle = escapeHtml(title)
  const safeLink = escapeHtml(link)
  const safeAction = escapeHtml(action)
  return `<!doctype html>
<html lang="bg">
  <body style="margin:0;background:#fbf9f6;color:#211d19;font-family:Arial,sans-serif">
    <main style="max-width:560px;margin:32px auto;padding:36px 28px;background:#fffdf9;border:1px solid #ded7cf">
      <p style="margin:0 0 28px;font-family:Georgia,serif;font-size:22px;letter-spacing:.18em">PARFUMERIE</p>
      <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:400">${safeTitle}</h1>
      <p style="font-size:15px;line-height:1.7;color:#51483f">${message}</p>
      <p style="margin:28px 0">
        <a href="${safeLink}" style="display:inline-block;padding:14px 22px;background:#211d19;color:#fff;text-decoration:none;font-size:12px;font-weight:bold;letter-spacing:.12em">${safeAction}</a>
      </p>
      <p style="font-size:12px;line-height:1.6;color:#71665c">Ако бутонът не работи, копирайте този адрес в браузъра:<br /><a href="${safeLink}" style="color:#51483f;word-break:break-all">${safeLink}</a></p>
      <hr style="margin:28px 0;border:0;border-top:1px solid #ded7cf" />
      <p style="font-size:12px;line-height:1.6;color:#71665c">Ако не сте заявили това действие, можете да игнорирате имейла.</p>
    </main>
  </body>
</html>`
}

export default class AbvSmtpNotificationService extends AbstractNotificationProviderService {
  static identifier = "notification-abv-smtp"

  protected logger_: Logger
  protected options_: ProviderOptions
  protected transporter_: Transporter | null

  constructor({ logger }: InjectedDependencies, options: ProviderOptions) {
    super()
    this.logger_ = logger
    this.options_ = options

    if (options.pass) {
      this.transporter_ = nodemailer.createTransport({
        host: options.host,
        port: options.port,
        secure: options.secure,
        auth: {
          user: options.user,
          pass: options.pass,
        },
      })
    } else {
      this.transporter_ = null
      if (process.env.NODE_ENV === "production") {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "SMTP_PASS must be configured before running in production."
        )
      }
      this.logger_.warn(
        "ABV SMTP credentials are not configured. Account emails will be logged for local development only."
      )
    }
  }

  async send(
    notification: NotificationTypes.ProviderSendNotificationDTO
  ): Promise<NotificationTypes.ProviderSendNotificationResultsDTO> {
    const data = notification.data || {}
    let subject: string
    let title: string
    let message: string
    let action: string
    let link: string

    if (notification.template === "email-verification") {
      subject = "Потвърдете имейла си — Parfumerie"
      title = "Потвърдете имейла си"
      message = "Използвайте бутона по-долу, за да потвърдите адреса си и да активирате профила си."
      action = "ПОТВЪРДИ ИМЕЙЛА"
      link = typeof data.verification_url === "string" ? data.verification_url : ""
    } else if (notification.template === "password-reset") {
      subject = "Смяна на парола — Parfumerie"
      title = "Смяна на паролата"
      message = "Получихме заявка за смяна на паролата за профила ви. Използвайте линка по-долу, за да зададете нова. Линкът е еднократен и изтича след кратко време."
      action = "ЗАДАЙ НОВА ПАРОЛА"
      link = typeof data.reset_url === "string" ? data.reset_url : ""
    } else {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Unsupported email template: ${notification.template}`
      )
    }

    if (!link) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Missing link for email template: ${notification.template}`
      )
    }

    const text = `${title}\n\n${message}\n\n${action}: ${link}\n\nАко не сте заявили това действие, можете да игнорирате имейла.`

    if (!this.transporter_) {
      this.logger_.info(
        `[Local email preview] Subject: ${subject}. Message link omitted to keep one-time tokens out of logs.`
      )
      return {}
    }

    try {
      const result = await this.transporter_.sendMail({
        from: notification.from?.trim() || this.options_.from,
        to: notification.to,
        subject,
        text,
        html: emailLayout(title, message, link, action),
      })

      return { id: result.messageId }
    } catch (error) {
      this.logger_.error("Failed to send account email through ABV SMTP", error)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Неуспешно изпращане на имейл. Проверете SMTP настройките на АБВ Поща."
      )
    }
  }
}
