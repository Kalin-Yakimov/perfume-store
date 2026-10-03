import { createHmac } from "node:crypto"
import {
  getRevalidationTargets,
  isRevalidationSecretConfigured,
  parseRevalidationPayload,
  REVALIDATION_RESOURCES,
  verifyRevalidationSignature,
} from "../storefront-revalidation"

jest.mock("server-only", () => ({}))

const secret = "unit-test-only-revalidation-secret-at-least-32-chars"
const nowSeconds = 1_800_000_000
const timestamp = String(nowSeconds)
const utf8 = (value: string) => new TextEncoder().encode(value)
const body = utf8('{"version":1,"resources":["products"]}')
const sign = (value: Uint8Array, time = timestamp, key = secret) =>
  createHmac("sha256", key).update(`${time}.`).update(value).digest("hex")

describe("signed public cache revalidation", () => {
  it("authenticates the exact raw bytes with a current timestamp", () => {
    expect(
      verifyRevalidationSignature({
        body,
        timestamp,
        secret,
        signature: sign(body),
        nowSeconds,
      }),
    ).toBe(true)
    expect(
      verifyRevalidationSignature({
        body: utf8('{ "version":1,"resources":["products"]}'),
        timestamp,
        secret,
        signature: sign(body),
        nowSeconds,
      }),
    ).toBe(false)
  })

  it.each([-301, 301])(
    "rejects timestamps outside the bounded freshness window (%s)",
    (difference) => {
      const time = String(nowSeconds + difference)
      expect(
        verifyRevalidationSignature({
          body,
          timestamp: time,
          secret,
          signature: sign(body, time),
          nowSeconds,
        }),
      ).toBe(false)
    },
  )

  it.each([-300, 300])(
    "accepts the documented freshness boundary (%s)",
    (difference) => {
      const time = String(nowSeconds + difference)
      expect(
        verifyRevalidationSignature({
          body,
          timestamp: time,
          secret,
          signature: sign(body, time),
          nowSeconds,
        }),
      ).toBe(true)
    },
  )

  it.each([null, "", "1e9", "1800000000.1", "-1", "1234567890123"])(
    "rejects malformed timestamps %s",
    (time) => {
      expect(
        verifyRevalidationSignature({
          body,
          timestamp: time,
          secret,
          signature: sign(body),
          nowSeconds,
        }),
      ).toBe(false)
    },
  )

  it.each([null, "", "a", "g".repeat(64), "A".repeat(64), "a".repeat(66)])(
    "rejects malformed signatures without throwing",
    (signature) => {
      expect(
        verifyRevalidationSignature({
          body,
          timestamp,
          secret,
          signature,
          nowSeconds,
        }),
      ).toBe(false)
    },
  )

  it("rejects signatures signed with another secret and refuses weak/missing configuration", () => {
    expect(
      verifyRevalidationSignature({
        body,
        timestamp,
        secret,
        signature: sign(body, timestamp, "wrong-key"),
        nowSeconds,
      }),
    ).toBe(false)
    expect(isRevalidationSecretConfigured()).toBe(false)
    expect(isRevalidationSecretConfigured("short")).toBe(false)
    expect(isRevalidationSecretConfigured(" ".repeat(40))).toBe(false)
    expect(isRevalidationSecretConfigured(secret)).toBe(true)
    expect(isRevalidationSecretConfigured("change-me-" + "x".repeat(40))).toBe(
      false,
    )
    expect(isRevalidationSecretConfigured("replace-" + "x".repeat(40))).toBe(
      false,
    )
    expect(
      verifyRevalidationSignature({
        body,
        timestamp,
        secret: "short",
        signature: sign(body),
        nowSeconds,
      }),
    ).toBe(false)
  })

  it("normalizes shared secret whitespace consistently with the backend sender", () => {
    expect(
      verifyRevalidationSignature({
        body,
        timestamp,
        secret: `  ${secret}\n`,
        signature: sign(body),
        nowSeconds,
      }),
    ).toBe(true)
  })

  it("accepts only the finite public resource list and maps fixed targets", () => {
    expect(
      parseRevalidationPayload(
        utf8(
          JSON.stringify({
            version: 1,
            resources: [...REVALIDATION_RESOURCES],
          }),
        ),
      ),
    ).toEqual({ version: 1, resources: [...REVALIDATION_RESOURCES] })
    expect(
      getRevalidationTargets(["products", "variants", "perfume_taxonomies"]),
    ).toEqual({
      tags: ["products", "variants"],
      paths: ["/sitemap.xml"],
    })
    expect(getRevalidationTargets(["payment_providers"])).toEqual({
      tags: ["payment_providers"],
      paths: [],
    })
  })

  it.each([
    null,
    [],
    {},
    { version: 2, resources: ["products"] },
    { version: 1, resources: [] },
    { version: 1, resources: ["products", "products"] },
    { version: 1, resources: "products" },
    { version: 1, resources: [1] },
    { version: 1, resources: ["customer"] },
    { version: 1, resources: ["cart"] },
    { version: 1, resources: ["orders"] },
    { version: 1, resources: ["unknown"] },
    { version: 1, resources: ["products"], path: "/vhod" },
    { version: 1, resources: ["products"], tags: ["customer"] },
  ])(
    "rejects malformed payloads, private resources and sender-controlled paths/tags",
    (value) => {
      expect(parseRevalidationPayload(utf8(JSON.stringify(value)))).toBeNull()
    },
  )

  it("rejects invalid JSON and invalid UTF-8 rather than repairing signed bytes", () => {
    expect(parseRevalidationPayload(utf8("{"))).toBeNull()
    expect(parseRevalidationPayload(new Uint8Array([0xff, 0xfe]))).toBeNull()
  })
})
