export const getBaseURL = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL

  if (!baseUrl && process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_BASE_URL must be set to the public storefront URL in production.",
    )
  }

  return baseUrl || "http://localhost:8000"
}
