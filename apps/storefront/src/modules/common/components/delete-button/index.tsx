import { deleteLineItem } from "@lib/data/cart"
import { Spinner, Trash } from "@medusajs/icons"
import { clx } from "@modules/common/components/ui"
import { useState } from "react"
import { useRouter } from "next/navigation"

const DeleteButton = ({
  id,
  children,
  className,
  "data-testid": dataTestId,
}: {
  id: string
  children?: React.ReactNode
  className?: string
  "data-testid"?: string
}) => {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    setError(null)
    try {
      await deleteLineItem(id)
      router.refresh()
    } catch {
      setError("Продуктът не можа да бъде премахнат. Опитайте отново.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div
      className={clx(
        "flex items-center justify-between text-small-regular",
        className
      )}
    >
      <button
        type="button"
        aria-label={typeof children === "string" ? children : "Премахни продукта"}
        disabled={isDeleting}
        data-testid={dataTestId}
        className="flex gap-x-1 text-ui-fg-subtle hover:text-ui-fg-base cursor-pointer"
        onClick={() => handleDelete(id)}
      >
        {isDeleting ? <Spinner className="animate-spin" /> : <Trash />}
        <span>{children}</span>
      </button>
      {error && <span role="alert" className="text-xs text-rose-600">{error}</span>}
    </div>
  )
}

export default DeleteButton
