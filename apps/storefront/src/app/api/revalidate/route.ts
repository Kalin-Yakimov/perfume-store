import { revalidatePath, revalidateTag } from "next/cache"
import {
  getRevalidationTargets,
  isRevalidationAuthenticationCurrent,
  isRevalidationSecretConfigured,
  parseRevalidationPayload,
  REVALIDATION_MAX_BODY_BYTES,
  verifyRevalidationSignature,
} from "@lib/util/storefront-revalidation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const respond = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } })

class OversizedBodyError extends Error {}
class BodyReadTimeoutError extends Error {}

/** Limit streamed requests too; Content-Length is optional and untrusted. */
async function readBoundedBody(request: Request): Promise<Uint8Array> {
  if (!request.body) return new Uint8Array()
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let timeout: ReturnType<typeof setTimeout>
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new BodyReadTimeoutError()), 5000)
  })

  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), deadline])
      if (done) break
      total += value.byteLength
      if (total > REVALIDATION_MAX_BODY_BYTES) {
        throw new OversizedBodyError()
      }
      chunks.push(value)
    }
  } finally {
    clearTimeout(timeout!)
    // A malicious stream can also stall cancel(), so don't await cancellation.
    void reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }

  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

export async function POST(request: Request) {
  const secret = process.env.STOREFRONT_REVALIDATION_SECRET?.trim()
  if (!isRevalidationSecretConfigured(secret)) {
    return respond(503, { error: "Revalidation is not configured" })
  }

  const contentType = request.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase()
  if (contentType !== "application/json") {
    return respond(415, { error: "Expected application/json" })
  }

  const timestamp = request.headers.get("x-storefront-revalidation-timestamp")
  const signature = request.headers.get("x-storefront-revalidation-signature")
  if (!isRevalidationAuthenticationCurrent({ timestamp, signature })) {
    return respond(401, { error: "Unauthorized" })
  }

  const declaredLength = request.headers.get("content-length")
  if (declaredLength !== null && !/^\d+$/.test(declaredLength)) {
    return respond(400, { error: "Invalid content length" })
  }
  if (
    declaredLength !== null &&
    Number(declaredLength) > REVALIDATION_MAX_BODY_BYTES
  ) {
    return respond(413, { error: "Payload too large" })
  }

  let body: Uint8Array
  try {
    body = await readBoundedBody(request)
  } catch (error) {
    return error instanceof OversizedBodyError
      ? respond(413, { error: "Payload too large" })
      : error instanceof BodyReadTimeoutError
        ? respond(408, { error: "Payload read timed out" })
        : respond(400, { error: "Could not read payload" })
  }

  if (
    !verifyRevalidationSignature({
      body,
      timestamp,
      signature,
      secret,
    })
  ) {
    return respond(401, { error: "Unauthorized" })
  }

  const payload = parseRevalidationPayload(body)
  if (!payload) return respond(400, { error: "Invalid revalidation payload" })

  const targets = getRevalidationTargets(payload.resources)
  try {
    for (const tag of targets.tags) revalidateTag(tag)
    for (const path of targets.paths) revalidatePath(path)
  } catch {
    // The sender can retry safely. Never log payloads, credentials or headers.
    return respond(500, { error: "Revalidation failed" })
  }

  return respond(200, { revalidated: true })
}
