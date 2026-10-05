const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * Medusa Cloud-related environment variables
 */
const S3_HOSTNAME = process.env.MEDUSA_CLOUD_S3_HOSTNAME
const S3_PATHNAME = process.env.MEDUSA_CLOUD_S3_PATHNAME
const MEDUSA_BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
const MEDUSA_IMAGE_ORIGIN = new URL(MEDUSA_BACKEND_URL)
const MEDUSA_IMAGE_PATH = MEDUSA_IMAGE_ORIGIN.pathname.replace(/\/$/, "")

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Avoid traversing the complete icon barrel during page compilation.
    optimizePackageImports: ["@medusajs/icons"],
  },
  // Local preview and browser tests must not overwrite the development build.
  ...(process.env.LOCAL_PREVIEW_RUN === "1"
    ? { distDir: ".next-preview" }
    : process.env.E2E_RUN === "1" ? { distDir: ".next-e2e" } : {}),
  logging: {
    fetches: {
      // Query strings can contain one-time reset or verification tokens.
      fullUrl: false,
    },
  },
  async headers() {
    const generalSecurityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
    ]
    const privateLinkHeaders = [
      {
        key: "Cache-Control",
        value: "private, no-store, max-age=0, must-revalidate",
      },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ]
    const privateLinkRoutes = [
      // These Bulgarian slugs are the public email URLs; the English paths
      // are their internal App Router destinations after middleware rewrites.
      "/nova-parola",
      "/:countryCode/nova-parola",
      "/reset-password",
      "/:countryCode/reset-password",
      "/potvardi-profil",
      "/:countryCode/potvardi-profil",
      "/verify-account",
      "/:countryCode/verify-account",
      "/order/:id/transfer/:token",
      "/:countryCode/order/:id/transfer/:token",
      "/order/:id/transfer/:token/accept",
      "/:countryCode/order/:id/transfer/:token/accept",
      "/order/:id/transfer/:token/decline",
      "/:countryCode/order/:id/transfer/:token/decline",
    ]

    return [
      { source: "/:path*", headers: generalSecurityHeaders },
      ...privateLinkRoutes.map((source) => ({
        source,
        headers: privateLinkHeaders,
      })),
    ]
  },
  images: {
    qualities: [60, 75],
    remotePatterns: [
      {
        protocol: MEDUSA_IMAGE_ORIGIN.protocol.slice(0, -1),
        hostname: MEDUSA_IMAGE_ORIGIN.hostname,
        port: MEDUSA_IMAGE_ORIGIN.port,
        pathname: `${MEDUSA_IMAGE_PATH}/**`,
      },
      {
        protocol: "https",
        hostname: "*.s3.*.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
      },
      ...(S3_HOSTNAME && S3_PATHNAME
        ? [
            {
              protocol: "https",
              hostname: S3_HOSTNAME,
              pathname: S3_PATHNAME,
            },
          ]
        : []),
    ],
  },
}

module.exports = nextConfig
