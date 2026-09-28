type QuantitySelectorProps = {
  value: string
  onChange: (value: string) => void
  maxQuantity?: number | null
  disabled?: boolean
  compact?: boolean
  message?: string
}

const QuantitySelector = ({
  value,
  onChange,
  maxQuantity = null,
  disabled = false,
  compact = false,
  message,
}: QuantitySelectorProps) => {
  const quantity = Number(value)
  const validQuantity = Number.isInteger(quantity) && quantity > 0
  const decrement = () =>
    onChange(String(Math.max(1, (validQuantity ? quantity : 1) - 1)))
  const increment = () =>
    onChange(
      String(
        Math.min(
          maxQuantity ?? Number.MAX_SAFE_INTEGER,
          (validQuantity ? quantity : 0) + 1,
        ),
      ),
    )

  return (
    <div
      className={`flex items-center justify-between ${compact ? "gap-2" : "gap-4"}`}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-[#302a25]">Количество</span>
        {message && (
          <span role="alert" className="text-xs text-red-700">
            {message}
          </span>
        )}
      </div>
      <div className="inline-flex h-10 items-center overflow-hidden rounded-md border border-[#cfc5ba] bg-white">
        <button
          type="button"
          aria-label="Намали количеството"
          onClick={decrement}
          disabled={disabled || !validQuantity || quantity <= 1}
          className="h-full w-10 text-lg text-[#302a25] transition hover:bg-[#f3eee8] disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>
        <output
          id={compact ? "mobile-product-quantity" : "product-quantity"}
          aria-label="Брой продукти"
          aria-live="polite"
          className="flex h-full w-12 items-center justify-center border-x border-[#e4ddd5] bg-transparent text-center text-sm font-semibold text-[#302a25]"
        >
          {value}
        </output>
        <button
          type="button"
          aria-label="Увеличи количеството"
          onClick={increment}
          disabled={
            disabled ||
            (validQuantity && maxQuantity !== null && quantity >= maxQuantity)
          }
          className="h-full w-10 text-lg text-[#302a25] transition hover:bg-[#f3eee8] disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  )
}

export default QuantitySelector
