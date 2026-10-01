import { sdk } from "@lib/config"
import { revalidatePath } from "next/cache"
import { getAuthHeaders } from "../cookies"
import {
  addCustomerAddress,
  deleteCustomerAddress,
  updateCustomer,
  updateCustomerAddress,
} from "../customer"

jest.mock("@lib/config", () => ({
  sdk: {
    store: {
      customer: {
        update: jest.fn(),
        createAddress: jest.fn(),
        deleteAddress: jest.fn(),
        updateAddress: jest.fn(),
      },
    },
  },
}))
jest.mock("../cookies", () => ({
  getAuthHeaders: jest.fn(async () => ({ authorization: "Bearer test" })),
}))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("next/navigation", () => ({ redirect: jest.fn() }))

describe("customer mutation refresh", () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest
      .mocked(getAuthHeaders)
      .mockResolvedValue({ authorization: "Bearer test" })
    jest.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it("refreshes the profile and navigation after updating customer details", async () => {
    jest
      .mocked(sdk.store.customer.update)
      .mockResolvedValue({ customer: { first_name: "Ново име" } } as Awaited<
        ReturnType<typeof sdk.store.customer.update>
      >)
    expect(await updateCustomer({ first_name: "Ново име" })).toMatchObject({
      first_name: "Ново име",
    })
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout")
  })

  it.each(["create", "update", "delete"])(
    "refreshes addresses after a successful %s",
    async (operation) => {
      jest
        .mocked(sdk.store.customer.createAddress)
        .mockResolvedValue(
          {} as Awaited<ReturnType<typeof sdk.store.customer.createAddress>>,
        )
      jest
        .mocked(sdk.store.customer.updateAddress)
        .mockResolvedValue(
          {} as Awaited<ReturnType<typeof sdk.store.customer.updateAddress>>,
        )
      jest
        .mocked(sdk.store.customer.deleteAddress)
        .mockResolvedValue(
          {} as Awaited<ReturnType<typeof sdk.store.customer.deleteAddress>>,
        )
      const result =
        operation === "create"
          ? await addCustomerAddress({}, new FormData())
          : operation === "update"
            ? await updateCustomerAddress(
                { addressId: "address_1" },
                new FormData(),
              )
            : await deleteCustomerAddress("address_1")
      expect(result.success).toBe(true)
      expect(revalidatePath).toHaveBeenCalledWith("/", "layout")
    },
  )

  it("reports failed deletion instead of silently returning success", async () => {
    jest
      .mocked(sdk.store.customer.deleteAddress)
      .mockRejectedValue(new Error("Network unavailable"))
    expect(await deleteCustomerAddress("address_1")).toEqual({
      success: false,
      error: "Адресът не можа да бъде изтрит.",
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("does not refresh or claim success for failed saves", async () => {
    jest
      .mocked(sdk.store.customer.update)
      .mockRejectedValue(new Error("Network unavailable"))
    await expect(updateCustomer({ first_name: "Име" })).rejects.toThrow()
    jest
      .mocked(sdk.store.customer.updateAddress)
      .mockRejectedValue(new Error("Network unavailable"))
    expect(
      (await updateCustomerAddress({ addressId: "address_1" }, new FormData()))
        .success,
    ).toBe(false)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
