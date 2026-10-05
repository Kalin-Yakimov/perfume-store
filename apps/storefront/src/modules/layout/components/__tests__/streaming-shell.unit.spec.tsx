import { PassThrough } from "node:stream"
import { renderToPipeableStream } from "react-dom/server"
import type { HttpTypes } from "@medusajs/types"
import { listCartOptions } from "@lib/data/cart"
import { retrieveCartForRender } from "@lib/data/cart-read"
import { retrieveCustomerSummary } from "@lib/data/customer-read"
import type { CustomerSummary } from "@lib/data/customer-types"
import { listLocales } from "@lib/data/locales"
import { getLocale } from "@lib/data/locale-actions"
import PageLayout from "../../../../app/[countryCode]/(main)/layout"
import AccountMenuServer from "../account-menu-server"
import { CartShippingNudge } from "../cart-decorations"
import MobileMenu from "../mobile-menu"

jest.mock("server-only", () => ({}))
jest.mock("@lib/data/cart", () => ({ listCartOptions: jest.fn() }))
jest.mock("@lib/data/cart-read", () => ({ retrieveCartForRender: jest.fn() }))
jest.mock("@lib/data/customer-read", () => ({ retrieveCustomerSummary: jest.fn() }))
jest.mock("@lib/data/locales", () => ({ listLocales: jest.fn() }))
jest.mock("@lib/data/locale-actions", () => ({ getLocale: jest.fn() }))
jest.mock("@modules/common/components/localized-client-link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
jest.mock("../account-menu", () => ({
  __esModule: true,
  default: ({ customer }: { customer: CustomerSummary | null }) => (
    <span>{customer?.first_name || "Вход"}</span>
  ),
}))
jest.mock("../side-menu", () => ({
  __esModule: true,
  default: () => <button>Меню</button>,
}))
jest.mock("../nav-search", () => ({ __esModule: true, default: () => null }))
jest.mock("../wishlist-link", () => ({ __esModule: true, default: () => null }))
jest.mock("../cart-dropdown", () => ({ __esModule: true, default: () => null }))
jest.mock("../cart-mismatch-banner", () => ({
  __esModule: true,
  default: () => <aside>Cart notification</aside>,
}))
jest.mock("@modules/shipping/components/free-shipping-price-nudge", () => ({
  __esModule: true,
  default: () => <aside>Shipping notification</aside>,
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function renderShell() {
  const output = new PassThrough()
  let html = ""
  const shell = deferred<string>()
  const complete = deferred<string>()
  const errors: unknown[] = []
  let shellSent = false

  output.on("data", (chunk: Buffer) => {
    html += chunk.toString()
    if (!shellSent && html.includes("Catalog content")) {
      shellSent = true
      shell.resolve(html)
    }
  })
  output.on("end", () => complete.resolve(html))

  const stream = renderToPipeableStream(
    <PageLayout>
      <article>Catalog content</article>
    </PageLayout>,
    {
      onShellReady() {
        stream.pipe(output)
      },
      onError(error) {
        errors.push(error)
      },
    },
  )

  return { shell: shell.promise, complete: complete.promise, errors, stream }
}

beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(retrieveCartForRender).mockResolvedValue(null)
  jest.mocked(retrieveCustomerSummary).mockResolvedValue(null)
  jest.mocked(listLocales).mockResolvedValue(null)
  jest.mocked(getLocale).mockResolvedValue(null)
  jest.mocked(listCartOptions).mockResolvedValue({ shipping_options: [] })
})

it("streams page content and navigation while customer, cart and locales are pending", async () => {
  const cart = deferred<HttpTypes.StoreCart | null>()
  const customer = deferred<CustomerSummary | null>()
  const locales = deferred<null>()
  jest.mocked(retrieveCartForRender).mockReturnValue(cart.promise)
  jest.mocked(retrieveCustomerSummary).mockReturnValue(customer.promise)
  jest.mocked(listLocales).mockReturnValue(locales.promise)

  const render = renderShell()
  try {
    const shell = await render.shell
    expect(shell).toContain("Catalog content")
    expect(shell).toContain("Основна навигация")
    expect(shell).toContain("Зареждане на профила")
    expect(shell).not.toContain("Вход")
    expect(listCartOptions).not.toHaveBeenCalled()
  } finally {
    cart.resolve(null)
    customer.resolve(null)
    locales.resolve(null)
    await render.complete
  }
  expect(render.errors).toEqual([])
})

it("does not delay the shell for cart shipping rates", async () => {
  const cart = { id: "cart_1" } as HttpTypes.StoreCart
  const rates = deferred<{ shipping_options: HttpTypes.StoreCartShippingOption[] }>()
  const ratesRequested = deferred<void>()
  jest.mocked(retrieveCartForRender).mockResolvedValue(cart)
  jest.mocked(listCartOptions).mockImplementation(() => {
    ratesRequested.resolve()
    return rates.promise
  })

  const render = renderShell()
  try {
    expect(await render.shell).toContain("Catalog content")
    await ratesRequested.promise
    expect(listCartOptions).toHaveBeenCalledWith(cart.id)
  } finally {
    rates.resolve({ shipping_options: [] })
    await render.complete
  }
  expect(render.errors).toEqual([])
})

it("preserves the signed-in customer's first name when the account slot resolves", async () => {
  const customer: CustomerSummary = {
    id: "customer_1",
    email: "customer@example.test",
    first_name: "Мария",
  }
  jest.mocked(retrieveCustomerSummary).mockResolvedValue(customer)

  expect((await AccountMenuServer()).props.customer).toEqual(customer)
})

it("preserves locale choices in the mobile menu", async () => {
  const locales = [{ code: "bg", name: "Български" }]
  jest.mocked(listLocales).mockResolvedValue(locales)
  jest.mocked(getLocale).mockResolvedValue("bg")

  const menu = await MobileMenu()
  expect(menu.props).toEqual({ locales, currentLocale: "bg" })
})

it("skips optional shipping rates when there is no cart", async () => {
  expect(await CartShippingNudge()).toBeNull()
  expect(listCartOptions).not.toHaveBeenCalled()
})
