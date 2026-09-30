import { HttpTypes } from "@medusajs/types"
import { NextRequest, NextResponse } from "next/server"
import {
  getPublicCacheOptions,
  PUBLIC_CACHE_TTL,
} from "./lib/data/cache-policy"

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
const PUBLISHABLE_API_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
const DEFAULT_REGION = (
  process.env.NEXT_PUBLIC_DEFAULT_REGION || "bg"
).toLowerCase()

const regionMapCache = {
  regionMap: new Map<string, HttpTypes.StoreRegion>(),
  regionMapUpdated: 0,
}

async function getRegionMap() {
  const { regionMap, regionMapUpdated } = regionMapCache

  if (!BACKEND_URL) {
    throw new Error(
      "Middleware.ts: Error fetching regions. Did you set up regions in your Medusa Admin and define a NEXT_PUBLIC_MEDUSA_BACKEND_URL environment variable.",
    )
  }

  if (
    process.env.NODE_ENV === "development" ||
    !regionMap.keys().next().value ||
    regionMapUpdated < Date.now() - PUBLIC_CACHE_TTL.regions * 1000
  ) {
    // Fetch regions from Medusa. We can't use the JS client here because middleware is running on Edge and the client needs a Node environment.
    const response = await fetch(`${BACKEND_URL}/store/regions`, {
      method: "GET",
      headers: {
        "x-publishable-api-key": PUBLISHABLE_API_KEY!,
      },
      ...getPublicCacheOptions("regions"),
    })

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`)
    }

    const json = await response.json()

    const { regions } = json

    if (!regions?.length) {
      return new Map<string, HttpTypes.StoreRegion>()
    }

    // Drop removed country mappings before writing the current region list.
    regionMapCache.regionMap.clear()

    // Create a map of country codes to regions.
    regions.forEach((region: HttpTypes.StoreRegion) => {
      region.countries?.forEach((c) => {
        const countryCode = c.iso_2?.toLowerCase()
        if (countryCode) {
          regionMapCache.regionMap.set(countryCode, region)
        }
      })
    })

    regionMapCache.regionMapUpdated = Date.now()
  }

  return regionMapCache.regionMap
}

/**
 * Fetches regions from Medusa and sets the region cookie.
 * @param request
 * @param response
 */
async function getCountryCode(
  request: NextRequest,
  regionMap: Map<string, HttpTypes.StoreRegion | number>,
) {
  let countryCode

  const urlCountryCode = request.nextUrl.pathname.split("/")[1]?.toLowerCase()

  // Cloudflare Workers provides country via request.cf.country
  const cloudflareCountryCode = (
    request as { cf?: { country?: string } }
  ).cf?.country?.toLowerCase()

  // Vercel provides x-vercel-ip-country header
  const vercelCountryCode = request.headers
    .get("x-vercel-ip-country")
    ?.toLowerCase()

  if (urlCountryCode && regionMap.has(urlCountryCode)) {
    countryCode = urlCountryCode
  } else if (cloudflareCountryCode && regionMap.has(cloudflareCountryCode)) {
    countryCode = cloudflareCountryCode
  } else if (vercelCountryCode && regionMap.has(vercelCountryCode)) {
    countryCode = vercelCountryCode
  } else if (regionMap.has(DEFAULT_REGION)) {
    countryCode = DEFAULT_REGION
  } else if (regionMap.keys().next().value) {
    countryCode = regionMap.keys().next().value
  }

  return countryCode
}

/**
 * Middleware to handle region selection and onboarding status.
 */
export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.includes(".")) {
    return NextResponse.next()
  }

  const regionMap = await getRegionMap()
  const countryCode = await getCountryCode(request, regionMap)

  // if the country code is available, use it, otherwise use the default region
  const country = countryCode || DEFAULT_REGION
  const pathname = request.nextUrl.pathname.replace(/\/+$/, "") || "/"
  const segments = pathname.split("/").filter(Boolean)
  const firstSegment = segments[0]?.toLowerCase()
  const hasCountryPrefix = Boolean(firstSegment && regionMap.has(firstSegment))
  const routeOffset = hasCountryPrefix ? 1 : 0
  const legacyPathAliases: Record<string, string> = {
    store: "parfyumi",
    samples: "otlivki",
    decants: "otlivki",
    designers: "dizaynerski-kashti",
    notes: "parfyumni-notki",
    wishlist: "lyubimi",
    cart: "koshnitsa",
    account: "vhod",
    checkout: "zavarshvane-na-porachka",
    "verify-account": "potvardi-profil",
    "forgot-password": "zabravena-parola",
    "reset-password": "nova-parola",
  }
  const publicPathAliases: Record<string, string> = {
    lyubimi: "wishlist",
    koshnitsa: "cart",
    vhod: "account",
    "zavarshvane-na-porachka": "checkout",
    "potvardi-profil": "verify-account",
    "zabravena-parola": "forgot-password",
    "nova-parola": "reset-password",
  }
  const accountSubpathAliases: Record<string, string> = {
    profil: "profile",
    adresi: "addresses",
    porachki: "orders",
    podrobnosti: "details",
  }
  const legacyAccountSubpaths: Record<string, string> = {
    profile: "profil",
    addresses: "adresi",
    orders: "porachki",
    details: "podrobnosti",
  }

  const canonicalSegments = [...segments]
  const canonicalRouteSegment = canonicalSegments[routeOffset]?.toLowerCase()
  if (canonicalRouteSegment && legacyPathAliases[canonicalRouteSegment]) {
    canonicalSegments[routeOffset] = legacyPathAliases[canonicalRouteSegment]
  }
  if (canonicalSegments[routeOffset] === "vhod" && canonicalSegments[routeOffset + 1]) {
    const accountSubpath = canonicalSegments[routeOffset + 1].toLowerCase()
    canonicalSegments[routeOffset + 1] =
      legacyAccountSubpaths[accountSubpath] || accountSubpath
    if (canonicalSegments[routeOffset + 2]) {
      const accountDetail = canonicalSegments[routeOffset + 2].toLowerCase()
      canonicalSegments[routeOffset + 2] =
        legacyAccountSubpaths[accountDetail] || accountDetail
    }
  }

  const pathChanged = canonicalSegments.some((segment, index) => segment !== segments[index])
  const publicPath = `/${canonicalSegments.slice(routeOffset).join("/")}`
  const prefixedPublicPath = `/${country}${publicPath}`
  const shouldStripDefaultPrefix = hasCountryPrefix && firstSegment === DEFAULT_REGION

  // Redirect legacy English paths and explicit /bg URLs to a single public
  // Bulgarian-transliterated URL. Non-default regions keep their country code.
  if (pathChanged || shouldStripDefaultPrefix) {
    const targetPath = country === DEFAULT_REGION ? publicPath : prefixedPublicPath
    return NextResponse.redirect(
      new URL(`${targetPath}${request.nextUrl.search}`, request.url),
      307,
    )
  }

  const internalSegments = [...segments]
  const publicRouteSegment = internalSegments[routeOffset]?.toLowerCase()
  if (publicRouteSegment && publicPathAliases[publicRouteSegment]) {
    internalSegments[routeOffset] = publicPathAliases[publicRouteSegment]
  }
  if (internalSegments[routeOffset] === "account") {
    for (let index = routeOffset + 1; index < internalSegments.length; index += 1) {
      const internalSubpath = internalSegments[index].toLowerCase()
      internalSegments[index] = accountSubpathAliases[internalSubpath] || internalSubpath
    }
  }

  if (pathname === "/" || (hasCountryPrefix && segments.length === 1)) {
    const homePath =
      country === DEFAULT_REGION ? "/parfyumi" : `/${country}/parfyumi`
    return NextResponse.redirect(
      new URL(`${homePath}${request.nextUrl.search}`, request.url),
      307,
    )
  }

  if (!hasCountryPrefix && country === DEFAULT_REGION) {
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = `/${country}/${internalSegments.join("/")}`
    const response = NextResponse.rewrite(rewriteUrl)
    return response
  }

  if (hasCountryPrefix) {
    const internalPath = `/${firstSegment}/${internalSegments.slice(1).join("/")}`
    if (internalPath !== pathname) {
      const rewriteUrl = request.nextUrl.clone()
      rewriteUrl.pathname = internalPath
      const response = NextResponse.rewrite(rewriteUrl)
      return response
    }
    return NextResponse.next()
  }

  // Non-default regions retain their country code so region-specific prices
  // and inventory continue to resolve correctly.
  const redirectPath = pathname
  const queryString = request.nextUrl.search || ""
  const redirectUrl = `${request.nextUrl.origin}/${country}${redirectPath}${queryString}`

  return NextResponse.redirect(redirectUrl, 307)
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|assets|png|svg|jpg|jpeg|gif|webp).*)",
  ],
}
