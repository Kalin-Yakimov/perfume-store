type FilterRadioGroupProps = {
  title: string
  items: {
    value: string
    label: string
  }[]
  value: string
  handleChange: (value: string) => void
  "data-testid"?: string
}

const FilterRadioGroup = ({
  title,
  items,
  value,
  handleChange,
  "data-testid": dataTestId,
}: FilterRadioGroupProps) => {
  return (
    <fieldset data-testid={dataTestId}>
      <legend className="mb-4 text-sm font-semibold">{title}</legend>
      <div className="space-y-3">
        {items.map((item) => (
          <label
            key={item.value}
            className="flex cursor-pointer items-center gap-3 text-sm text-[#61564d]"
          >
            <input
              type="radio"
              name="product-sort"
              value={item.value}
              checked={item.value === value}
              onChange={() => handleChange(item.value)}
              className="h-4 w-4 border-[#a89687] accent-[#382f29]"
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default FilterRadioGroup
