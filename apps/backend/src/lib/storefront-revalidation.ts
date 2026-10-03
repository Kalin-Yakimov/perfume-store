import { createHmac } from "node:crypto"
import { MedusaError } from "@medusajs/framework/utils"
import type { StorefrontCacheResource } from "./catalog-events"

export type RevalidationConfig = { url: string; secret: string }
type Env = Record<string, string | undefined>

export function getStorefrontRevalidationConfig(env: Env): RevalidationConfig | null {
  const url = env.STOREFRONT_REVALIDATION_URL?.trim()
  const secret = env.STOREFRONT_REVALIDATION_SECRET?.trim()
  if (!url && !secret) return null
  if (!url || !secret || secret.length < 32 || /^(change[-_ ]?me|replace)/i.test(secret)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Configure both storefront revalidation variables with a random secret of at least 32 characters.")
  }
  if (secret === env.JWT_SECRET?.trim() || secret === env.COOKIE_SECRET?.trim()) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Storefront revalidation must not reuse an authentication secret.")
  }

  let endpoint: URL
  try {
    endpoint = new URL(url)
  } catch {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Storefront revalidation URL must be absolute.")
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)
  if (
    !["http:", "https:"].includes(endpoint.protocol) ||
    (endpoint.protocol === "http:" && (!local || env.NODE_ENV === "production")) ||
    endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
    endpoint.pathname !== "/api/revalidate"
  ) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Storefront revalidation requires HTTPS, or a local HTTP endpoint in development, at /api/revalidate.")
  }
  return { url: endpoint.toString(), secret }
}

type RevalidationDependencies = {
  fetch: typeof globalThis.fetch
  now: () => number
  delay: (ms: number) => Promise<void>
}

const defaultDependencies: RevalidationDependencies = {
  fetch: (input, init) => globalThis.fetch(input, init),
  now: () => Date.now(),
  delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}

/** A small process-local batch avoids one HTTP call per row in bulk admin edits.
 * No database lock is held during network I/O. Failures stay bounded; public
 * TTLs remain the recovery path while the storefront is unavailable. */
export function createStorefrontRevalidator(
  config: RevalidationConfig,
  dependencies: RevalidationDependencies = defaultDependencies,
) {
  let pending = new Set<StorefrontCacheResource>()
  let flight: Promise<void> | undefined

  async function send(resources: StorefrontCacheResource[]) {
    const body = JSON.stringify({ version: 1, resources })
    for (let attempt = 0; attempt < 3; attempt++) {
      const timestamp = String(Math.floor(dependencies.now() / 1000))
      const signature = createHmac("sha256", config.secret)
        .update(`${timestamp}.${body}`)
        .digest("hex")
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2000)
      let retry = true
      try {
        const response = await dependencies.fetch(config.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-storefront-revalidation-timestamp": timestamp,
            "x-storefront-revalidation-signature": signature,
          },
          body,
          signal: controller.signal,
          redirect: "error",
        })
        // Never retain/log a response body containing internal diagnostics.
        void response.body?.cancel().catch(() => undefined)
        if (response.ok) return
        retry = response.status === 408 || response.status === 429 || response.status >= 500
      } catch {
        // Network failures are retryable. Never propagate a URL or response body.
      } finally {
        clearTimeout(timeout)
      }
      if (!retry || attempt === 2) {
        throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Storefront cache invalidation could not be delivered.")
      }
      await dependencies.delay(100 * (attempt + 1))
    }
  }

  async function flush() {
    try {
      // Give overlapping events a chance to join one batch.
      await dependencies.delay(50)
      while (pending.size) {
        const resources = [...pending].sort()
        pending = new Set()
        try {
          await send(resources)
        } catch (error) {
          // Keep the resources for the next admin event; don't spin indefinitely.
          resources.forEach((resource) => pending.add(resource))
          throw error
        }
      }
    } finally {
      // Clear synchronously with the last pending check, not a later promise
      // microtask: an event arriving as this batch settles must start a new one.
      flight = undefined
    }
  }

  return (resources: StorefrontCacheResource[]) => {
    resources.forEach((resource) => pending.add(resource))
    if (!pending.size) return Promise.resolve()
    if (!flight) {
      flight = flush()
    }
    return flight
  }
}
