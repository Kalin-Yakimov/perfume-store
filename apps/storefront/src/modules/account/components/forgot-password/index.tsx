"use client"

import { useActionState } from "react"
import { requestPasswordReset } from "@lib/data/customer"
import Input from "@modules/common/components/input"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const inputClassName =
  "mt-0 block h-12 w-full appearance-none rounded-none border border-[#ded7cf] bg-[#fffdf9] px-4 pb-1 pt-4 text-sm text-[#211d19] outline-none transition-colors hover:border-[#b9aa9b] focus:border-[#806e60] focus:ring-0"

const ForgotPassword = () => {
  const [result, formAction] = useActionState(requestPasswordReset, null)

  return (
    <div className="w-full max-w-md" data-testid="forgot-password-page">
      <h1 className="mb-3 font-display text-3xl font-normal tracking-[-0.03em] text-[#211d19]">
        Забравена парола
      </h1>
      <p className="mb-7 text-sm leading-6 text-[#71665c]">
        Въведете имейла на профила си. Ако има регистриран профил с него,
        ще получите линк за смяна на паролата.
      </p>
      {result?.success ? (
        <div
          className="border border-[#ded7cf] bg-[#f1ece5] p-4 text-sm leading-6 text-[#51483f]"
          role="status"
          data-testid="password-reset-request-success"
        >
          Заявката е приета. Ако адресът е свързан с профил, ще получите линк
          за смяна на паролата. Проверете и папка „Спам“.
        </div>
      ) : (
        <form action={formAction} className="flex flex-col border-t border-[#ded7cf] pt-6">
          <Input
            className={inputClassName}
            label="Имейл"
            name="email"
            type="email"
            autoComplete="email"
            required
            data-testid="password-reset-email-input"
          />
          {result?.error && (
            <p className="mt-3 text-sm text-red-700" role="alert">{result.error}</p>
          )}
          <SubmitButton className="mt-6 h-12 w-full rounded-none bg-[#211d19] text-xs font-semibold uppercase tracking-[0.16em] text-white hover:bg-[#40372f]">
            Изпрати линк
          </SubmitButton>
        </form>
      )}
      <div className="mt-6 border-t border-[#ded7cf] pt-6 text-center text-sm text-[#71665c]">
        <LocalizedClientLink
          href="/vhod"
          className="font-semibold text-[#211d19] underline decoration-[#bda894] underline-offset-4"
        >
          Обратно към вход
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default ForgotPassword
