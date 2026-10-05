import { NextRequest } from "next/server"

const originalBackendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
const originalDefaultRegion = process.env.NEXT_PUBLIC_DEFAULT_REGION
const originalFetch = global.fetch
let middleware: typeof import("../middleware").middleware

beforeEach(async () => {
  jest.resetModules()
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL = "http://backend.example.test"
  process.env.NEXT_PUBLIC_DEFAULT_REGION = "bg"
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      regions: [
        { id: "region_bg", countries: [{ iso_2: "bg" }] },
        { id: "region_de", countries: [{ iso_2: "de" }] },
      ],
    }),
  })
  const middlewareModule = await import("../middleware")
  middleware = middlewareModule.middleware
})

afterEach(() => {
  global.fetch = originalFetch
  if (originalBackendUrl === undefined) delete process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
  else process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL = originalBackendUrl
  if (originalDefaultRegion === undefined) delete process.env.NEXT_PUBLIC_DEFAULT_REGION
  else process.env.NEXT_PUBLIC_DEFAULT_REGION = originalDefaultRegion
})

it.each([
  ["/parfyumi?q=armaf", "/bg/parfyumi?q=armaf"],
  ["/otlivki", "/bg/otlivki"],
  ["/vhod/profil", "/bg/account/profile"],
  ["/koshnitsa", "/bg/cart"],
  ["/zavarshvane-na-porachka?step=delivery", "/bg/checkout?step=delivery"],
])("rewrites %s without a blocking region request", async (path, target) => {
  const response = await middleware(new NextRequest(`http://localhost:8000${path}`))
  expect(response.headers.get("x-middleware-rewrite")).toBe(`http://localhost:8000${target}`)
  expect(global.fetch).not.toHaveBeenCalled()
})

it.each([
  ["/", "/parfyumi"],
  ["/bg", "/parfyumi"],
  ["/bg/cart?test=1", "/koshnitsa?test=1"],
  ["/account/orders/details/order_1", "/vhod/porachki/podrobnosti/order_1"],
])("canonicalizes %s without a region request", async (path, target) => {
  const response = await middleware(new NextRequest(`http://localhost:8000${path}`))
  expect(response.status).toBe(307)
  expect(response.headers.get("location")).toBe(`http://localhost:8000${target}`)
  expect(global.fetch).not.toHaveBeenCalled()
})

it("keeps region discovery for explicit non-default country URLs", async () => {
  const response = await middleware(new NextRequest("http://localhost:8000/de/koshnitsa"))
  expect(global.fetch).toHaveBeenCalledTimes(1)
  expect(response.headers.get("x-middleware-rewrite")).toBe("http://localhost:8000/de/cart")
})

it("keeps geolocation routing for configured non-default regions", async () => {
  const response = await middleware(new NextRequest("http://localhost:8000/parfyumi", {
    headers: { "x-vercel-ip-country": "DE" },
  }))
  expect(global.fetch).toHaveBeenCalledTimes(1)
  expect(response.headers.get("location")).toBe("http://localhost:8000/de/parfyumi")
})

it("respects an explicit Bulgarian prefix regardless of geolocation", async () => {
  const response = await middleware(new NextRequest("http://localhost:8000/bg/parfyumi", {
    headers: { "x-vercel-ip-country": "DE" },
  }))
  expect(response.headers.get("location")).toBe("http://localhost:8000/parfyumi")
  expect(global.fetch).not.toHaveBeenCalled()
})

it("does not interpret an unknown country prefix as a configured region", async () => {
  const response = await middleware(new NextRequest("http://localhost:8000/xx/parfyumi"))
  expect(global.fetch).toHaveBeenCalledTimes(1)
  expect(response.headers.get("x-middleware-rewrite")).toBe("http://localhost:8000/bg/xx/parfyumi")
})
