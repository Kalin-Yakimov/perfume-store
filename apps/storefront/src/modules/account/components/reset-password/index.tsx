"use client"

import { FormEvent, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { applyPasswordReset } from "@lib/data/customer"
import Input from "@modules/common/components/input"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const inputClassName =
  "mt-0 block h-12 w-full appearance-none rounded-none border border-[#ded7cf] bg-[#fffdf9] px-4 pb-1 pt-4 text-sm text-[#211d19] outline-none transition-colors hover:border-[#b9aa9b] focus:border-[#806e60] focus:ring-0"

const ResetPassword = () => {
  const searchParams = useSearchParams()
  const [token] = useState(() => searchParams.get("token") || "")
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (token) {
      // Keep the one-time credential in memory but remove it from the visible
      // URL/history as soon as the form has captured it.
      window.history.replaceState(null, "", window.location.pathname)
    }
  }, [token])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get("password") || "")
    const confirmation = String(form.get("confirm_password") || "")

    if (password !== confirmation) {
      setMessage("Паролите не съвпадат.")
      return
    }

    setPending(true)
    setMessage(null)
    const result = await applyPasswordReset(token, password)
    setPending(false)
    setSuccess(result.success)
    setMessage(
      result.success
        ? "Паролата е сменена успешно. Вече можете да влезете в профила си."
        : result.error || "Възникна грешка. Опитайте отново."
    )
  }

  return (
    <div className="w-full max-w-md" data-testid="reset-password-page">
      <h1 className="mb-3 font-display text-3xl font-normal tracking-[-0.03em] text-[#211d19]">
        Нова парола
      </h1>
      <p className="mb-7 text-sm leading-6 text-[#71665c]">
        Изберете нова парола с поне 8 символа.
      </p>
      {success ? (
        <div className="border border-[#ded7cf] bg-[#f1ece5] p-4 text-sm leading-6 text-[#51483f]" role="status">
          {message}{" "}
          <LocalizedClientLink href="/vhod" className="font-semibold underline">
            Към вход
          </LocalizedClientLink>
        </div>
      ) : !token ? (
        <div className="border border-[#ded7cf] bg-[#f1ece5] p-4 text-sm leading-6 text-[#51483f]" role="alert">
          Липсва токен за смяна на паролата. {" "}
          <LocalizedClientLink href="/zabravena-parola" className="font-semibold underline">
            Поискайте нов линк.
          </LocalizedClientLink>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col border-t border-[#ded7cf] pt-6">
          <Input
            className={inputClassName}
            label="Нова парола"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <Input
            className={inputClassName}
            label="Повторете паролата"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          {message && <p className="mt-3 text-sm text-red-700" role="alert">{message}</p>}
          <button
            type="submit"
            disabled={pending}
            className="mt-6 h-12 w-full rounded-none bg-[#211d19] text-xs font-semibold uppercase tracking-[0.16em] text-white hover:bg-[#40372f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Запазване…" : "Запази новата парола"}
          </button>
        </form>
      )}
    </div>
  )
}

export default ResetPassword
