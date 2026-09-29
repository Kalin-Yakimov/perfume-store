import { loadEnv, defineConfig, MedusaError } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const storefrontUrl =
  process.env.STOREFRONT_URL?.trim() || "http://localhost:8000"

if (process.env.NODE_ENV === "production") {
  if (!process.env.STOREFRONT_URL?.trim()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "STOREFRONT_URL must point to the public storefront in production.",
    )
  }

  let parsedStorefrontUrl: URL
  try {
    parsedStorefrontUrl = new URL(storefrontUrl)
  } catch {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "STOREFRONT_URL must be a valid absolute URL in production.",
    )
  }

  const isLocalHost =
    ["localhost", "127.0.0.1", "[::1]", "::1"].includes(
      parsedStorefrontUrl.hostname,
    ) || parsedStorefrontUrl.hostname.endsWith(".localhost")

  if (
    parsedStorefrontUrl.protocol !== "https:" ||
    isLocalHost ||
    parsedStorefrontUrl.username ||
    parsedStorefrontUrl.password ||
    parsedStorefrontUrl.pathname !== "/" ||
    parsedStorefrontUrl.search ||
    parsedStorefrontUrl.hash
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "STOREFRONT_URL must use a public HTTPS address in production.",
    )
  }
}

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      authVerificationsPerActor: {
        customer: [
          {
            entity_type: "email",
            auth_provider: "emailpass",
          },
        ],
      },
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    }
  },
  admin: {
    storefrontUrl,
  },
  modules: [
    {
      resolve: "./src/modules/perfume-taxonomy",
    },
    {
      resolve: "./src/modules/decant-stock",
    },
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "./src/modules/abv-smtp-notification",
            id: "abv-smtp",
            options: {
              channels: ["email"],
              host: process.env.SMTP_HOST || "smtp.abv.bg",
              port: Number(process.env.SMTP_PORT || 465),
              secure: process.env.SMTP_SECURE !== "false",
              user: process.env.SMTP_USER || "icrosoft@abv.bg",
              pass: process.env.SMTP_PASS?.trim() || "",
              from: process.env.SMTP_FROM_EMAIL || "icrosoft@abv.bg",
            },
          },
        ],
      },
    },
  ],
})
