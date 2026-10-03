import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"
import type { PublicCacheResource } from "@lib/data/cache-policy"

export const REVALIDATION_MAX_BODY_BYTES = 4096
export const REVALIDATION_MAX_AGE_SECONDS = 300
export const REVALIDATION_RESOURCES = [
  "products",
  "variants",
  "categories",
  "collections",
  "regions",
  "locales",
  "payment_providers",
  "perfume_taxonomies",
] as const

export type RevalidationResource = (typeof REVALIDATION_RESOURCES)[number]
export type RevalidationPayload = {
  version: 1
  resources: RevalidationResource[]
}

const allowedResources = new Set<string>(REVALIDATION_RESOURCES)
const sitemapResources = new Set<RevalidationResource>([
  "products",
  "variants",
  "categories",
  "collections",
  "regions",
  "locales",
  "perfume_taxonomies",
])

export function isRevalidationSecretConfigured(
  secret?: string,
): secret is string {
  return (
    typeof secret === "string" &&
    secret.trim().length >= 32 &&
    !/^(change[-_ ]?me|replace)/i.test(secret.trim())
  )
}

export function isRevalidationAuthenticationCurrent({
  timestamp,
  signature,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  timestamp: string | null
  signature: string | null
  nowSeconds?: number
}): boolean {
  if (
    !timestamp ||
    !/^\d{1,12}$/.test(timestamp) ||
    !signature ||
    !/^[a-f0-9]{64}$/.test(signature)
  ) {
    return false
  }

  const sentAt = Number(timestamp)
  if (
    !Number.isSafeInteger(sentAt) ||
    !Number.isSafeInteger(nowSeconds) ||
    Math.abs(nowSeconds - sentAt) > REVALIDATION_MAX_AGE_SECONDS
  ) {
    return false
  }
  return true
}

/** Authenticate the exact bytes received, not a parsed/re-serialized payload. */
export function verifyRevalidationSignature({
  body,
  timestamp,
  signature,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  body: Uint8Array
  timestamp: string | null
  signature: string | null
  secret: string
  nowSeconds?: number
}): boolean {
  if (
    !isRevalidationSecretConfigured(secret) ||
    !timestamp ||
    !signature ||
    !isRevalidationAuthenticationCurrent({ timestamp, signature, nowSeconds })
  )
    return false

  const expected = Uint8Array.from(
    createHmac("sha256", secret.trim())
      .update(timestamp)
      .update(".")
      .update(body)
      .digest(),
  )

  return timingSafeEqual(
    expected,
    Uint8Array.from(Buffer.from(signature, "hex")),
  )
}

export function parseRevalidationPayload(
  body: Uint8Array,
): RevalidationPayload | null {
  try {
    const value: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(body),
    )
    if (!value || typeof value !== "object" || Array.isArray(value)) return null

    const payload = value as Record<string, unknown>
    const keys = Object.keys(payload)
    if (
      keys.length !== 2 ||
      !keys.includes("version") ||
      !keys.includes("resources") ||
      payload.version !== 1 ||
      !Array.isArray(payload.resources) ||
      payload.resources.length === 0 ||
      payload.resources.length > REVALIDATION_RESOURCES.length ||
      payload.resources.some(
        (resource) =>
          typeof resource !== "string" || !allowedResources.has(resource),
      ) ||
      new Set(payload.resources).size !== payload.resources.length
    ) {
      return null
    }

    return payload as RevalidationPayload
  } catch {
    return null
  }
}

export function getRevalidationTargets(resources: RevalidationResource[]) {
  return {
    // Taxonomies use no-store reads; only their generated sitemap is cached.
    tags: resources.filter(
      (resource): resource is PublicCacheResource =>
        resource !== "perfume_taxonomies",
    ),
    // Paths come from this fixed mapping, never from the webhook sender.
    paths: resources.some((resource) => sitemapResources.has(resource))
      ? ["/sitemap.xml"]
      : [],
  }
}
