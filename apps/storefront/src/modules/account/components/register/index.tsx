"use client"

import { useActionState } from "react"
import Input from "@modules/common/components/input"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { signup } from "@lib/data/customer"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

const inputClassName =
  "mt-0 block h-12 w-full appearance-none rounded-none border border-[#ded7cf] bg-[#fffdf9] px-4 pb-1 pt-4 text-sm text-[#211d19] outline-none transition-colors hover:border-[#b9aa9b] focus:border-[#806e60] focus:ring-0"

const Register = ({ setCurrentView }: Props) => {
  const [message, formAction] = useActionState(signup, null)

  return (
    <div className="w-full max-w-md" data-testid="register-page">
      <h2 className="mb-3 font-display text-3xl font-normal leading-tight tracking-[-0.03em] text-[#211d19]">
        Създайте профил
      </h2>
      <p className="mb-6 text-sm leading-6 text-[#71665c]">
        Регистрирайте се, за да следите поръчките и любимите си аромати.
      </p>
      {message?.state === "verification_required" && (
        <div
          className="mb-4 w-full border border-[#ded7cf] bg-[#f1ece5] p-4 text-center text-sm leading-6 text-[#51483f]"
          data-testid="register-verification-message"
        >
          Изпратихме линк за потвърждение на <strong>{message.email}</strong>.
          Проверете пощата си, за да потвърдите имейла и да влезете.
        </div>
      )}
      <form
        className="flex w-full flex-col border-t border-[#ded7cf] pt-6"
        action={formAction}
      >
        <div className="flex flex-col w-full gap-y-2">
          <Input
            className={inputClassName}
            label="Име"
            name="first_name"
            required
            autoComplete="given-name"
            data-testid="first-name-input"
          />
          <Input
            className={inputClassName}
            label="Фамилия"
            name="last_name"
            required
            autoComplete="family-name"
            data-testid="last-name-input"
          />
          <Input
            className={inputClassName}
            label="Имейл"
            name="email"
            required
            type="email"
            autoComplete="email"
            data-testid="email-input"
          />
          <Input
            className={inputClassName}
            label="Телефон"
            name="phone"
            type="tel"
            autoComplete="tel"
            data-testid="phone-input"
          />
          <Input
            className={inputClassName}
            label="Парола"
            name="password"
            required
            type="password"
            autoComplete="new-password"
            data-testid="password-input"
          />
        </div>
        <ErrorMessage
          error={message?.state === "error" ? message.error : null}
          data-testid="register-error"
        />
        <span className="mt-6 text-center text-xs leading-5 text-[#71665c]">
          Със създаването на профил приемате нашите{" "}
          <LocalizedClientLink
            href="/legal"
            className="text-[#211d19] underline decoration-[#bda894] underline-offset-4"
          >
            правила за поверителност
          </LocalizedClientLink>{" "}
          и{" "}
          <LocalizedClientLink
            href="/legal"
            className="text-[#211d19] underline decoration-[#bda894] underline-offset-4"
          >
            общи условия
          </LocalizedClientLink>
          .
        </span>
        <SubmitButton
          className="mt-6 h-12 w-full rounded-none bg-[#211d19] text-xs font-semibold uppercase tracking-[0.16em] text-white hover:bg-[#40372f]"
          data-testid="register-button"
        >
          Създай профил
        </SubmitButton>
      </form>
      <span className="mt-6 block border-t border-[#ded7cf] pt-6 text-center text-sm text-[#71665c]">
        Вече имате профил?{" "}
        <button
          onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
          className="font-semibold text-[#211d19] underline decoration-[#bda894] underline-offset-4 hover:decoration-[#211d19]"
        >
          Вход
        </button>
      </span>
    </div>
  )
}

export default Register
