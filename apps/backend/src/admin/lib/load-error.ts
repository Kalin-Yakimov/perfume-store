export function isMissingAdminRecord(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "status" in error &&
    error.status === 404,
  )
}
