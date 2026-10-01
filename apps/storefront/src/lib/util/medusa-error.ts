type RequestError = {
  status?: unknown
  message?: unknown
  response?: { status?: unknown; data?: unknown }
}

/** Medusa SDK FetchError uses status; older clients used response.status. */
export function getMedusaErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined
  const requestError = error as RequestError
  const status = requestError.status ?? requestError.response?.status
  return typeof status === "number" &&
    Number.isInteger(status) &&
    status >= 100 &&
    status <= 599
    ? status
    : undefined
}

export default function medusaError(error: unknown): never {
  const status = getMedusaErrorStatus(error)
  const fallback = "Заявката не можа да бъде изпълнена. Опитайте отново."
  let message = fallback

  if (status !== undefined && status >= 400 && status < 500) {
    const requestError = error as RequestError
    const data = requestError.response?.data
    const upstreamMessage =
      typeof data === "object" && data !== null && "message" in data
        ? data.message
        : requestError.message
    if (typeof upstreamMessage === "string") {
      message =
        upstreamMessage
          .replace(/[\r\n\u0000-\u001f]+/g, " ")
          .trim()
          .slice(0, 300) || fallback
    }
  }

  // Never log messages, bodies or headers: they can contain private data.
  if (status !== undefined)
    console.error("Medusa request failed with status", status)
  else console.error("Medusa request failed before receiving a response")
  throw new Error(message)
}
