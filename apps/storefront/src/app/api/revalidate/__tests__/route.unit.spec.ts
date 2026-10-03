import { createHmac } from "node:crypto"
import { revalidatePath, revalidateTag } from "next/cache"
import { POST } from "../route"

jest.mock("server-only", () => ({}))
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}))

const secret = "unit-test-only-revalidation-secret-at-least-32-chars"
const originalSecret = process.env.STOREFRONT_REVALIDATION_SECRET
const nowSeconds = 1_800_000_000
const json = (resources = ["products"]) =>
  JSON.stringify({ version: 1, resources })

function request(
  body = json(),
  headers: Record<string, string> = {},
  timestamp = String(nowSeconds),
) {
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex")
  return new Request("http://localhost:8000/api/revalidate", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "x-storefront-revalidation-timestamp": timestamp,
      "x-storefront-revalidation-signature": signature,
      ...headers,
    },
  })
}

beforeEach(() => {
  jest.resetAllMocks()
  jest.spyOn(Date, "now").mockReturnValue(nowSeconds * 1000)
  process.env.STOREFRONT_REVALIDATION_SECRET = secret
})

afterEach(() => {
  jest.restoreAllMocks()
  if (originalSecret === undefined)
    delete process.env.STOREFRONT_REVALIDATION_SECRET
  else process.env.STOREFRONT_REVALIDATION_SECRET = originalSecret
})

it("invalidates public tags and a fixed sitemap only after authenticating the exact request", async () => {
  const response = await POST(
    request(json(["products", "variants", "perfume_taxonomies"])),
  )
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ revalidated: true })
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(revalidateTag).toHaveBeenCalledTimes(2)
  expect(revalidateTag).toHaveBeenNthCalledWith(1, "products")
  expect(revalidateTag).toHaveBeenNthCalledWith(2, "variants")
  expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml")
})

it("keeps taxonomies no-store while refreshing their generated sitemap", async () => {
  const response = await POST(request(json(["perfume_taxonomies"])))
  expect(response.status).toBe(200)
  expect(revalidateTag).not.toHaveBeenCalled()
  expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml")
})

it.each([
  undefined,
  "short",
  "change-me-" + "x".repeat(40),
  "replace-" + "x".repeat(40),
])(
  "fails closed when the server-only secret is missing/weak",
  async (value) => {
    if (value === undefined) delete process.env.STOREFRONT_REVALIDATION_SECRET
    else process.env.STOREFRONT_REVALIDATION_SECRET = value
    const response = await POST(request())
    expect(response.status).toBe(503)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(revalidateTag).not.toHaveBeenCalled()
  },
)

it("uses the same trimmed secret as the backend sender", async () => {
  process.env.STOREFRONT_REVALIDATION_SECRET = `  ${secret}\n`
  expect((await POST(request())).status).toBe(200)
})

it("rejects unauthenticated headers before reading a body", async () => {
  const input = request(json(), { "x-storefront-revalidation-signature": "" })
  const getReader = jest.spyOn(input.body!, "getReader")
  expect((await POST(input)).status).toBe(401)
  expect(getReader).not.toHaveBeenCalled()
})

it("bounds the read time of a stream that never produces or closes its body", async () => {
  jest.useFakeTimers({ now: nowSeconds * 1000 })
  const cancel = jest.fn()
  const input = {
    headers: request().headers,
    body: new ReadableStream({ cancel }),
  } as Request
  try {
    const pendingResponse = POST(input)
    await jest.advanceTimersByTimeAsync(5000)
    const response = await pendingResponse
    expect(response.status).toBe(408)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(revalidateTag).not.toHaveBeenCalled()
  } finally {
    jest.useRealTimers()
  }
})

it.each<Record<string, string>>([
  { "x-storefront-revalidation-signature": "" },
  { "x-storefront-revalidation-signature": "0".repeat(64) },
  { "x-storefront-revalidation-timestamp": "" },
])(
  "rejects absent/incorrect authentication without invalidating anything",
  async (headers) => {
    const response = await POST(request(json(), headers))
    expect(response.status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  },
)

it("rejects an expired but otherwise valid signature", async () => {
  expect(
    (await POST(request(json(), {}, String(nowSeconds - 301)))).status,
  ).toBe(401)
  expect(revalidateTag).not.toHaveBeenCalled()
})

it.each([
  "{",
  json(["customer"]),
  json(["cart"]),
  json(["orders"]),
  JSON.stringify({ version: 1, resources: ["products"], path: "/" }),
  JSON.stringify({ version: 1, resources: ["products"], tags: ["customer"] }),
])(
  "rejects malformed signed payloads and unauthorized targets",
  async (body) => {
    expect((await POST(request(body))).status).toBe(400)
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  },
)

it("rejects unsupported content types and accepts JSON with a charset", async () => {
  expect(
    (await POST(request(json(), { "content-type": "text/plain" }))).status,
  ).toBe(415)
  expect(
    (
      await POST(
        request(json(), { "content-type": "application/json; charset=utf-8" }),
      )
    ).status,
  ).toBe(200)
})

it("limits bodies even when Content-Length is missing or forged", async () => {
  const body = json() + " ".repeat(4096)
  expect((await POST(request(body))).status).toBe(413)
  expect((await POST(request(body, { "content-length": "1" }))).status).toBe(
    413,
  )
  expect(revalidateTag).not.toHaveBeenCalled()
})

it("rejects declared oversized/invalid lengths before reading the request", async () => {
  expect(
    (await POST(request(json(), { "content-length": "4097" }))).status,
  ).toBe(413)
  expect(
    (await POST(request(json(), { "content-length": "invalid" }))).status,
  ).toBe(400)
  expect(revalidateTag).not.toHaveBeenCalled()
})

it("reports revalidation errors for a safe sender retry without exposing internals", async () => {
  jest.mocked(revalidateTag).mockImplementationOnce(() => {
    throw new Error("private internal details")
  })
  const response = await POST(request())
  expect(response.status).toBe(500)
  expect(await response.json()).toEqual({ error: "Revalidation failed" })
  expect(response.headers.get("cache-control")).toBe("no-store")
})
