type MedusaError = {
  response?: {
    data: unknown
    status: number
  }
  message?: string
}

export default function medusaError(error: unknown): never {
  const err = error as MedusaError
  if (err.response) {
    const data = err.response.data
    const upstreamMessage =
      typeof data === "object" && data !== null && "message" in data
        ? data.message
        : undefined
    const safeMessage =
        err.response.status >= 500
        ? "The request could not be completed. Please try again."
        : typeof upstreamMessage === "string"
          ? upstreamMessage
              .replace(/[\r\n\u0000-\u001f]+/g, " ")
              .trim()
              .slice(0, 300)
          : "The request could not be completed. Please try again."

    // Do not log response bodies or headers: either can contain customer data,
    // cookies, or credentials. A status code is enough for server diagnostics.
    console.error("Medusa request failed with status", err.response.status)
    throw new Error(
      safeMessage
        ? safeMessage.charAt(0).toUpperCase() +
          safeMessage.slice(1).replace(/[.!?]*$/, ".")
        : "The request could not be completed. Please try again.",
    )
  }

  console.error("Medusa request failed before receiving a response")
  throw new Error("The request could not be completed. Please try again.")
}
