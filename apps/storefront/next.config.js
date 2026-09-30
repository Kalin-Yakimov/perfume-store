const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * Medusa Cloud-related environment variables
 */
const S3_HOSTNAME = process.env.MEDUSA_CLOUD_S3_HOSTNAME
const S3_PATHNAME = process.env.MEDUSA_CLOUD_S3_PATHNAME

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
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
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
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
