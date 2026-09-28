"use client"

import { useState } from "react"

import Register from "@modules/account/components/register"
import Login from "@modules/account/components/login"

export enum LOGIN_VIEW {
  SIGN_IN = "sign-in",
  REGISTER = "register",
}

const LoginTemplate = () => {
  const [currentView, setCurrentView] = useState("sign-in")

  return (
    <div className="flex flex-1 flex-col bg-[#fbf9f6]">
      <section className="border-b border-[#ded7cf] bg-[#eee8df] py-7 small:py-8">
        <div className="content-container max-w-5xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#826c5a]">
            Вашият профил
          </p>
          <h1 className="font-display mt-1 text-3xl tracking-[-0.02em] small:text-4xl">
            {currentView === LOGIN_VIEW.SIGN_IN ? "Вход" : "Регистрация"}
          </h1>
        </div>
      </section>
      <section className="content-container flex max-w-5xl flex-1 items-center justify-center py-10 small:py-14">
        {currentView === LOGIN_VIEW.SIGN_IN ? (
          <Login setCurrentView={setCurrentView} />
        ) : (
          <Register setCurrentView={setCurrentView} />
        )}
      </section>
    </div>
  )
}

export default LoginTemplate
