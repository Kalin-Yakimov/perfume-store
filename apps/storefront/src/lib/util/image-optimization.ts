const MEDUSA_BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

/**
 * Only send known Medusa/S3 origins through Next's image optimizer. Admin
 * product images can also be pasted from arbitrary hosts, which should keep
 * rendering directly instead of failing Next's remotePatterns allowlist.
 */
export const canOptimizeImage = (source: string) => {
  try {
    const imageUrl = new URL(source)
    const backendUrl = new URL(MEDUSA_BACKEND_URL)
    const backendPath = backendUrl.pathname.replace(/\/$/, "")

    if (imageUrl.origin === backendUrl.origin) {
      return (
        !backendPath ||
        imageUrl.pathname === backendPath ||
        imageUrl.pathname.startsWith(`${backendPath}/`)
      )
    }

    if (imageUrl.protocol !== "https:") {
      return false
    }

    return (
      /^[^.]+\.s3\.[^.]+\.amazonaws\.com$/.test(imageUrl.hostname) ||
      /^[^.]+\.s3\.amazonaws\.com$/.test(imageUrl.hostname)
    )
  } catch {
    return false
  }
}
