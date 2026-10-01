"use client"

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react"

type CartMutationContextValue = {
  revision: string
  isMutating: boolean
  beginMutation: () => boolean
  finishMutation: () => void
}

const CartMutationContext = createContext<CartMutationContextValue | null>(null)

export function CartMutationProvider({
  revision,
  children,
}: {
  revision: string
  children: ReactNode
}) {
  const pending = useRef(false)
  const [isMutating, setIsMutating] = useState(false)
  const [generation, setGeneration] = useState(0)

  const beginMutation = useCallback(() => {
    // The ref also guards clicks before React has rendered disabled buttons.
    if (pending.current) return false
    pending.current = true
    setIsMutating(true)
    return true
  }, [])

  const finishMutation = useCallback(() => {
    pending.current = false
    setIsMutating(false)
    // Recheck all rows on success or failure, even before router.refresh ends.
    setGeneration((current) => current + 1)
  }, [])

  const value = useMemo(
    () => ({
      revision: `${revision}:${generation}`,
      isMutating,
      beginMutation,
      finishMutation,
    }),
    [revision, generation, isMutating, beginMutation, finishMutation],
  )

  return (
    <CartMutationContext.Provider value={value}>
      {children}
    </CartMutationContext.Provider>
  )
}

export const useCartMutation = () => useContext(CartMutationContext)
