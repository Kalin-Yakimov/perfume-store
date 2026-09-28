/** Keep stored variant values intact while showing Bulgarian units in the shop. */
export const formatVolumeForDisplay = (value: string) =>
  value.replace(/(\d+(?:[.,]\d+)?)\s*ml\b/gi, "$1 мл")

/** Keep decant size choices out of the product name; they belong to variants. */
export const formatProductTitle = (value: string, isDecant = false) =>
  formatVolumeForDisplay(
    isDecant
      ? value.replace(
          /\s*\(\s*\d+(?:[.,]\d+)?\s*\/\s*\d+(?:[.,]\d+)?\s*(?:ml|мл)\s*\)\s*$/i,
          "",
        )
      : value,
  )
