/** @jest-environment jsdom */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { HttpTypes } from "@medusajs/types"
import {
  deleteLineItem,
  getCartLineItemQuantityLimit,
  updateLineItem,
} from "@lib/data/cart"
import { getCartStockRevision } from "@lib/util/cart-stock-revision"
import ItemsTemplate from "../templates/items"

const refresh = jest.fn()
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }))
jest.mock("@lib/data/cart", () => ({
  getCartLineItemQuantityLimit: jest.fn(),
  updateLineItem: jest.fn(),
  deleteLineItem: jest.fn(),
}))
jest.mock("@modules/common/components/localized-client-link", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}))
jest.mock("@modules/products/components/thumbnail", () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock("@modules/common/components/line-item-options", () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock("@modules/common/components/line-item-price", () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock("@modules/common/components/line-item-unit-price", () => ({
  __esModule: true,
  default: () => null,
}))

function cart(secondQuantity = 1): HttpTypes.StoreCart {
  return {
    id: "cart_1",
    currency_code: "eur",
    items: [
      {
        id: "bottle",
        product_id: "product_1",
        variant_id: "variant_1",
        title: "Бутилка",
        quantity: 1,
        created_at: "2026-01-01",
      },
      {
        id: "decant",
        product_id: "product_2",
        variant_id: "variant_2",
        title: "Отливка",
        quantity: secondQuantity,
        created_at: "2026-01-02",
      },
    ],
  } as unknown as HttpTypes.StoreCart
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const stock = jest.mocked(getCartLineItemQuantityLimit)
const row = (title: string) => within(screen.getByText(title).closest("tr")!)
const plus = (title: string) =>
  row(title).getByRole("button", {
    name: "Увеличи количеството",
  }) as HTMLButtonElement

describe("shared cart stock limits", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    stock.mockResolvedValue(10)
  })

  it("uses a stable revision without changing the source item order", async () => {
    const original = cart()
    const reversed = { ...original, items: [...original.items!].reverse() }
    expect(getCartStockRevision(original)).toBe(getCartStockRevision(reversed))
    render(<ItemsTemplate cart={original} />)
    await waitFor(() => expect(plus("Бутилка").disabled).toBe(false))
    expect(original.items!.map((item) => item.id)).toEqual(["bottle", "decant"])
  })

  it("rechecks unchanged rows when a sibling quantity changes or a row is removed", async () => {
    const view = render(<ItemsTemplate cart={cart()} />)
    await waitFor(() => expect(plus("Бутилка").disabled).toBe(false))
    expect(stock).toHaveBeenCalledTimes(2)
    stock.mockResolvedValue(1)
    view.rerender(<ItemsTemplate cart={cart(2)} />)
    await waitFor(() => expect(stock).toHaveBeenCalledTimes(4))
    await waitFor(() => expect(plus("Бутилка").disabled).toBe(true))
    stock.mockResolvedValue(3)
    const remaining = cart(2)
    remaining.items = remaining.items!.filter((item) => item.id === "bottle")
    view.rerender(<ItemsTemplate cart={remaining} />)
    await waitFor(() => expect(stock).toHaveBeenCalledTimes(5))
    await waitFor(() => expect(plus("Бутилка").disabled).toBe(false))
  })

  it("disables competing mutations and rechecks every row after a quantity update", async () => {
    const pending = deferred<Awaited<ReturnType<typeof updateLineItem>>>()
    jest.mocked(updateLineItem).mockReturnValue(pending.promise)
    render(<ItemsTemplate cart={cart()} />)
    await waitFor(() => expect(plus("Бутилка").disabled).toBe(false))
    fireEvent.click(plus("Бутилка"))
    expect(plus("Отливка").disabled).toBe(true)
    expect(
      (
        row("Отливка").getByRole("button", {
          name: "Премахни продукта",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true)
    fireEvent.click(plus("Отливка"))
    expect(updateLineItem).toHaveBeenCalledTimes(1)
    expect(stock).toHaveBeenCalledTimes(2)
    await act(async () => {
      pending.resolve(undefined)
    })
    await waitFor(() => expect(stock).toHaveBeenCalledTimes(4))
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(row("Бутилка").getByLabelText("Брой продукти").textContent).toBe("2")
  })

  it("rechecks all limits after deletion and after a rejected mutation", async () => {
    render(<ItemsTemplate cart={cart()} />)
    await waitFor(() => expect(plus("Бутилка").disabled).toBe(false))
    fireEvent.click(
      row("Отливка").getByRole("button", { name: "Премахни продукта" }),
    )
    await waitFor(() => expect(stock).toHaveBeenCalledTimes(4))
    expect(deleteLineItem).toHaveBeenCalledWith("decant")
    await waitFor(() => expect(plus("Бутилка").disabled).toBe(false))
    jest
      .mocked(updateLineItem)
      .mockRejectedValueOnce(new Error("Няма достатъчна наличност"))
    fireEvent.click(plus("Бутилка"))
    await waitFor(() => expect(stock).toHaveBeenCalledTimes(6))
    expect(screen.getByText("Няма достатъчна наличност")).toBeTruthy()
    expect(row("Бутилка").getByLabelText("Брой продукти").textContent).toBe("1")
  })

  it("ignores a late stock response for an older cart snapshot", async () => {
    const oldLimit = deferred<number | null>()
    stock.mockImplementation((id) =>
      id === "bottle" ? oldLimit.promise : Promise.resolve(10),
    )
    const view = render(<ItemsTemplate cart={cart()} />)
    await waitFor(() => expect(stock).toHaveBeenCalledTimes(2))
    stock.mockResolvedValue(1)
    view.rerender(<ItemsTemplate cart={cart(2)} />)
    await waitFor(() => expect(stock).toHaveBeenCalledTimes(4))
    await act(async () => {
      oldLimit.resolve(20)
    })
    expect(plus("Бутилка").disabled).toBe(true)
  })

  it("shows stock lookup failures without enabling unvalidated increases", async () => {
    stock.mockRejectedValue(
      new Error("Наличността временно не може да бъде проверена."),
    )
    render(<ItemsTemplate cart={cart()} />)
    await waitFor(() =>
      expect(
        screen.getAllByText("Наличността временно не може да бъде проверена."),
      ).toHaveLength(2),
    )
    expect(plus("Бутилка").disabled).toBe(true)
  })
})
