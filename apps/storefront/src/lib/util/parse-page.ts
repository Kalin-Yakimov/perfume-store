export function parsePage(value?: string, maxPage = 100_001) {
  const page = Number(value)
  // Keep offsets bounded and treat malformed/negative page values as page one.
  return Number.isSafeInteger(page) && page > 0 && page <= maxPage ? page : 1
}
