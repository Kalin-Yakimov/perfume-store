import { Metadata } from "next"

import LoginTemplate from "@modules/account/templates/login-template"

export const metadata: Metadata = {
  title: "Вход в профила",
  description: "Влезте във вашия профил в Parfumerie.",
}

export default function Login() {
  return <LoginTemplate />
}
