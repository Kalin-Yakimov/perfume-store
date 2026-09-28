import { login } from "@lib/data/customer"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"
import { useActionState } from "react"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

const inputClassName =
  "mt-0 block h-12 w-full appearance-none rounded-none border border-[#ded7cf] bg-[#fffdf9] px-4 pb-1 pt-4 text-sm text-[#211d19] outline-none transition-colors hover:border-[#b9aa9b] focus:border-[#806e60] focus:ring-0"

const Login = ({ setCurrentView }: Props) => {
  const [message, formAction] = useActionState(login, null)

  return (
    <div className="w-full max-w-md" data-testid="login-page">
      <h2 className="mb-3 font-display text-3xl font-normal leading-tight tracking-[-0.03em] text-[#211d19]">
        Добре дошли
      </h2>
      <p className="mb-7 text-sm leading-6 text-[#71665c]">
        Влезте в профила си, за да управлявате поръчките и любимите си аромати.
      </p>
      {message?.state === "verification_required" && (
        <div
          className="mb-6 w-full border border-[#ded7cf] bg-[#f1ece5] p-4 text-center text-sm leading-6 text-[#51483f]"
          data-testid="login-verification-message"
        >
          Изпратихме линк за потвърждение на <strong>{message.email}</strong>.
          Потвърдете имейла си и след това влезте.
        </div>
      )}
      <form
        className="w-full border-t border-[#ded7cf] pt-6"
        action={formAction}
      >
        <div className="flex flex-col w-full gap-y-2">
          <Input
            className={inputClassName}
            label="Имейл"
            name="email"
            type="email"
            title="Въведете валиден имейл адрес."
            autoComplete="email"
            required
            data-testid="email-input"
          />
          <Input
            className={inputClassName}
            label="Парола"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            data-testid="password-input"
          />
        </div>
        <ErrorMessage
          error={message?.state === "error" ? message.error : null}
          data-testid="login-error-message"
        />
        <SubmitButton
          data-testid="sign-in-button"
          className="mt-6 h-12 w-full rounded-none bg-[#211d19] text-xs font-semibold uppercase tracking-[0.16em] text-white hover:bg-[#40372f]"
        >
          Вход
        </SubmitButton>
      </form>
      <span className="mt-6 block border-t border-[#ded7cf] pt-6 text-center text-sm text-[#71665c]">
        Нямате профил?{" "}
        <button
          onClick={() => setCurrentView(LOGIN_VIEW.REGISTER)}
          className="font-semibold text-[#211d19] underline decoration-[#bda894] underline-offset-4 hover:decoration-[#211d19]"
          data-testid="register-button"
        >
          Създайте профил
        </button>
      </span>
    </div>
  )
}

export default Login
