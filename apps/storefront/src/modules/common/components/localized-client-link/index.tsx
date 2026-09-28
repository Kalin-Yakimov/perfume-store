"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import React from "react"

const publicRouteAliases: Record<string, string> = {
  wishlist: "lyubimi",
  cart: "koshnitsa",
  account: "vhod",
  checkout: "zavarshvane-na-porachka",
}

const accountSubpathAliases: Record<string, string> = {
  profile: "profil",
  addresses: "adresi",
  orders: "porachki",
  details: "podrobnosti",
}

/**
 * Creates a localized link while keeping the default Bulgarian region hidden
 * from public URLs and using the store's Bulgarian-transliterated route names.
 */
const LocalizedClientLink = ({
  children,
  href,
  ...props
}: {
  children?: React.ReactNode
  href: string
  className?: string
  onClick?: () => void
  passHref?: true
  [x: string]: unknown
}) => {
  const { countryCode } = useParams() as { countryCode?: string }
  const [path, suffix = ""] = href.split(/(?=[?#])/, 2)
  const segments = path.split("/").filter(Boolean)
  const routeSegment = segments[0]?.toLowerCase()

  if (routeSegment && publicRouteAliases[routeSegment]) {
    segments[0] = publicRouteAliases[routeSegment]
  }
  if (segments[0] === "vhod") {
    for (let index = 1; index < segments.length; index += 1) {
      const subpath = segments[index].toLowerCase()
      segments[index] = accountSubpathAliases[subpath] || subpath
    }
  }

  const publicPath = `/${segments.join("/")}${suffix}`
  const countryPrefix = countryCode && countryCode !== "bg" ? `/${countryCode}` : ""

  return (
    <Link href={`${countryPrefix}${publicPath}`} {...props}>
      {children}
    </Link>
  )
}

export default LocalizedClientLink
