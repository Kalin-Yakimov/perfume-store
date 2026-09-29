"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@modules/common/components/ui"
import { confirmEmailVerification } from "@lib/data/customer"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type VerificationState =
  "verifying" | "success_signed_in" | "success_sign_in_required" | "error"

const VerifyAccount = () => {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [state, setState] = useState<VerificationState>("verifying")
  // Guard against the effect running twice in React Strict Mode, which would
  // consume the single-use token before the customer sees the result.
  const confirmed = useRef(false)

  useEffect(() => {
    if (confirmed.current) {
      return
    }
    confirmed.current = true

    if (!token) {
      setState("error")
      return
    }

    confirmEmailVerification(token).then(({ success, signedIn }) => {
      setState(
        success
          ? signedIn
            ? "success_signed_in"
            : "success_sign_in_required"
          : "error",
      )
    })
  }, [token])

  return (
    <div
      className="max-w-sm w-full flex flex-col items-center text-center gap-y-4"
      data-testid="verify-account-page"
    >
      <h1 className="font-display text-3xl text-[#211d19]">
        Потвърждение на имейл
      </h1>

      {state === "verifying" && (
        <p className="text-base-regular text-ui-fg-base">
          Проверяваме имейла ви…
        </p>
      )}

      {state === "success_signed_in" && (
        <>
          <p className="text-base-regular text-ui-fg-base">
            Имейлът е потвърден и вече сте в профила си.
          </p>
          <LocalizedClientLink href="/account">
            <Button variant="primary">Към профила</Button>
          </LocalizedClientLink>
        </>
      )}

      {state === "success_sign_in_required" && (
        <>
          <p className="text-base-regular text-ui-fg-base">
            Имейлът е потвърден. Отворихте линка от друго устройство или сесията
            е изтекла — влезте в профила си, за да продължите.
          </p>
          <LocalizedClientLink href="/account">
            <Button variant="primary">Вход в профила</Button>
          </LocalizedClientLink>
        </>
      )}

      {state === "error" && (
        <>
          <p className="text-base-regular text-ui-fg-base">
            Линкът за потвърждение е невалиден или е изтекъл. Влезте отново, за
            да получите нов линк.
          </p>
          <LocalizedClientLink href="/vhod">
            <Button variant="secondary">Към вход</Button>
          </LocalizedClientLink>
        </>
      )}
    </div>
  )
}

export default VerifyAccount
