import { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Подбрани аромати",
  description:
    "Селекция от класически, нишови и съвременни аромати за всеки характер.",
}

export default function Home() {
  redirect("/parfyumi")
}
