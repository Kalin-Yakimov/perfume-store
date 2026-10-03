import {
  test,
  expect,
  type Page,
  type APIRequestContext,
  type BrowserContext,
} from "@playwright/test"

const password = "Synthetic-password-123!"
const card = (page: Page, title: string) =>
  page.locator("div.relative.h-full").filter({
    has: page.getByTestId("product-title").filter({ hasText: title }),
  })

async function restrictToLocal(context: BrowserContext) {
  // Keep every browser request local: courier maps, tracking and remote assets
  // are deliberately outside these synthetic customer journeys.
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url())
    if (["127.0.0.1", "localhost"].includes(url.hostname))
      await route.continue()
    else await route.abort()
  })
}

test.beforeEach(async ({ context }) => restrictToLocal(context))

async function mailLink(
  request: APIRequestContext,
  email: string,
  pathname: string,
) {
  let link = ""
  await expect
    .poll(
      async () => {
        const response = await request.get(
          `${process.env.E2E_MAIL_URL}/?to=${encodeURIComponent(email)}`,
          {
            headers: { authorization: `Bearer ${process.env.E2E_MAIL_KEY}` },
          },
        )
        expect(response.ok()).toBeTruthy()
        const messages = (await response.json()) as { links: string[] }[]
        link =
          messages
            .flatMap((message) => message.links)
            .find((value) => new URL(value).pathname === pathname) || ""
        return !!link
      },
      {
        timeout: 25_000,
        message:
          "Real SMTP delivers the requested account email to the local inbox",
      },
    )
    .toBe(true)
  expect(new URL(link).origin).toBe(process.env.E2E_BASE_URL)
  return link
}

async function register(page: Page, email: string) {
  await page.goto("/vhod?view=register")
  const form = page.getByTestId("register-page")
  await form.getByTestId("first-name-input").fill("Тест")
  await form.getByTestId("last-name-input").fill("Потребител")
  await form.getByTestId("email-input").fill(email)
  await form.getByTestId("phone-input").fill("+359888123456")
  await form.getByTestId("password-input").fill(password)
  await form.getByTestId("register-button").click()
  await expect(page.getByTestId("register-verification-message")).toBeVisible()
}

async function activate(page: Page, request: APIRequestContext, email: string) {
  await register(page, email)
  const link = await mailLink(request, email, "/potvardi-profil")
  await page.goto(link)
  await expect(
    page.getByText("Имейлът е потвърден и вече сте в профила си."),
  ).toBeVisible()
  await expect(page).toHaveURL(/\/potvardi-profil$/)
  await page.getByRole("link", { name: "Към профила", exact: true }).click()
  await expect(page.getByTestId("nav-account-link")).toContainText("Тест")
  return link
}

async function login(page: Page, email: string, secret = password) {
  await page.goto("/vhod")
  const form = page.getByTestId("login-page")
  await form.getByTestId("email-input").fill(email)
  await form.getByTestId("password-input").fill(secret)
  await form.getByTestId("sign-in-button").click()
}

async function logout(page: Page) {
  await page.getByTestId("nav-account-link").click()
  await page
    .getByRole("button", { name: "Изход от профила", exact: true })
    .click()
  await expect(page.getByTestId("login-page")).toBeVisible()
}

async function addBottle(page: Page) {
  await page.goto("/products/e2e-amber")
  await expect(page.getByTestId("add-product-button")).toBeEnabled()
  await page.getByTestId("add-product-button").click()
  await expect(page.getByTestId("add-product-button")).toBeEnabled()
  await page.goto("/koshnitsa")
  await expect(page.getByTestId("product-row")).toHaveCount(1)
}

async function checkout(page: Page, email: string) {
  await page.getByTestId("checkout-button").click()
  await expect(page).toHaveURL(/zavarshvane-na-porachka\?step=delivery/)
  await page.getByRole("radio", { name: /Еконт — адрес/ }).click()
  await page.getByTestId("submit-delivery-option-button").click()
  await expect(page).toHaveURL(/step=payment/)
  await page.getByRole("radio", { name: /Ръчно плащане/ }).click()
  await page.getByTestId("submit-payment-button").click()
  await expect(page).toHaveURL(/step=address/)
  await page.getByTestId("shipping-first-name-input").fill("Тест")
  await page.getByTestId("shipping-last-name-input").fill("Получател")
  await page.getByTestId("shipping-email-input").fill(email)
  await page.getByTestId("shipping-phone-input").fill("+359888123456")
  await page.getByTestId("shipping-address-input").fill("ул. Тестова 10")
  await page.getByTestId("shipping-city-input").fill("София")
  // Bulgaria-only checkout does not require company/country/postal code.
  await expect(
    page.getByTestId("shipping-postal-code-input"),
  ).not.toHaveAttribute("required")
  await page.getByTestId("submit-address-button").click()
  await expect(page).toHaveURL(/step=review/)
  await page.getByTestId("submit-order-button").click()
  await expect(page.getByTestId("order-complete-container")).toBeVisible()
  await expect(page.getByTestId("order-email")).toContainText(email)
  await expect(page.getByTestId("shipping-method-summary")).toContainText(
    "Еконт — адрес",
  )
  await expect(page.getByTestId("shipping-address-summary")).toContainText(
    "ул. Тестова 10",
  )
  await page.goto("/koshnitsa")
  await expect(page.getByTestId("product-row")).toHaveCount(0)
}

test("catalog keeps sold-out products last and opens them without price or purchase", async ({
  page,
}) => {
  await page.goto("/parfyumi")
  await expect(page.getByTestId("product-wrapper")).toHaveCount(2)
  await expect(page.getByTestId("product-title").last()).toContainText(
    "Sold Out",
  )
  const sold = card(page, "Sold Out")
  await expect(sold).toContainText("Няма наличност")
  await expect(sold).not.toContainText("€")
  await sold.getByTestId("product-title").click()
  await expect(page.getByTestId("add-product-button")).toBeDisabled()
  await expect(page.locator("#product-quantity")).toHaveText("0")
})

test("search suggestions show bottle volume/price and sold-out state", async ({
  page,
}) => {
  await page.goto("/parfyumi")
  const search = page.getByRole("searchbox", { name: /Търс/ })
  await search.fill("E2E")
  const bottle = page
    .getByRole("link")
    .filter({ hasText: "E2E House Amber" })
    .filter({ hasText: "100 мл" })
  await expect(bottle).toContainText(/40[.,]00/)
  await expect(
    page.getByRole("link").filter({ hasText: "E2E House Sold Out" }),
  ).toContainText(/Изчерпан|Няма наличност/)
})

test("guest favorites survive reload and can be removed", async ({ page }) => {
  await page.goto("/parfyumi")
  const amber = card(page, "Amber")
  await amber.getByRole("button", { name: "Добави в любими" }).click()
  await expect(
    amber.getByRole("button", { name: "Премахни от любими" }),
  ).toHaveAttribute("aria-pressed", "true")
  await page.goto("/lyubimi")
  await expect(page.getByRole("article")).toHaveCount(1)
  await expect(page.getByRole("article")).toContainText("100 мл")
  await expect(page.getByRole("article")).toContainText(/40[.,]00/)
  await page.reload()
  await expect(page.getByRole("article")).toHaveCount(1)
  await page.getByRole("button", { name: "Премахни", exact: true }).click()
  await expect(page.getByRole("article")).toHaveCount(0)
})

test("decant option changes price and cart variant; cart quantity updates and removal persist", async ({
  page,
}) => {
  await page.goto("/products/e2e-amber-decants")
  await expect(page.getByTestId("add-product-button")).toBeEnabled()
  await page.getByTestId("option-button").filter({ hasText: "10 мл" }).click()
  await expect(
    page.getByTestId("option-button").filter({ hasText: "10 мл" }),
  ).toHaveClass(/border-\[#2a241f\]/)
  await page.getByTestId("add-product-button").click()
  await expect(page.getByTestId("add-product-button")).toBeEnabled()
  await page.goto("/koshnitsa")
  const row = page.getByTestId("product-row")
  await expect(row).toContainText("10 мл")
  await expect(row).toContainText(/5[.,]30/)
  await row.getByRole("button", { name: "Увеличи количеството" }).click()
  await expect(row.getByLabel("Брой продукти")).toHaveText("2")
  await page.reload()
  await expect(row.getByLabel("Брой продукти")).toHaveText("2")
  await row.getByRole("button", { name: "Намали количеството" }).click()
  await expect(row.getByLabel("Брой продукти")).toHaveText("1")
  await row.getByTestId("product-delete-button").click()
  await expect(page.getByTestId("product-row")).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId("product-row")).toHaveCount(0)
})

test("invalid login does not grant account access", async ({ page }) => {
  await login(page, "unknown@example.invalid", "not-a-password")
  await expect(page.getByTestId("login-error-message")).toContainText(
    "не са правилни",
  )
  for (const path of [
    "/vhod/porachki",
    "/vhod/profil",
    "/vhod/adresi",
    "/vhod/porachki/podrobnosti/missing-order",
  ]) {
    await page.goto(path)
    await expect(page.getByTestId("login-page")).toBeVisible()
  }
})

test("email activation signs in only its original browser; token cannot be reused", async ({
  page,
  request,
  browser,
}) => {
  const email = "activation@example.invalid"
  const link = await activate(page, request, email)
  const otherContext = await browser.newContext()
  try {
    await restrictToLocal(otherContext)
    const otherPage = await otherContext.newPage()
    await otherPage.goto(link)
    await expect(
      otherPage.getByText("Линкът за потвърждение е невалиден или е изтекъл.", {
        exact: false,
      }),
    ).toBeVisible()
    await otherPage.goto(`${process.env.E2E_BASE_URL}/vhod/porachki`)
    await expect(otherPage.getByTestId("login-page")).toBeVisible()
  } finally {
    await otherContext.close()
  }
  await logout(page)
  await login(page, email)
  await expect(page.getByTestId("nav-account-link")).toContainText("Тест")
})

test("verification in a different browser confirms email without authenticating that browser", async ({
  page,
  request,
  browser,
}) => {
  await register(page, "cross-browser@example.invalid")
  const link = await mailLink(
    request,
    "cross-browser@example.invalid",
    "/potvardi-profil",
  )
  const context = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL,
  })
  try {
    await restrictToLocal(context)
    const other = await context.newPage()
    await other.goto(link)
    await expect(
      other.getByText(
        "Имейлът е потвърден. Отворихте линка от друго устройство",
        { exact: false },
      ),
    ).toBeVisible()
    await other.goto("/vhod/porachki")
    await expect(other.getByTestId("login-page")).toBeVisible()
  } finally {
    await context.close()
  }
  await login(page, "cross-browser@example.invalid")
  await expect(page.getByTestId("nav-account-link")).toContainText("Тест")
})

test("profile and address CRUD persist after reload", async ({
  page,
  request,
}) => {
  await activate(page, request, "profile@example.invalid")
  await page.goto("/vhod/profil")
  const editor = page.getByTestId("account-name-editor")
  await editor.getByTestId("edit-button").click()
  await editor.getByTestId("first-name-input").fill("Променено")
  await editor.getByTestId("save-button").click()
  await expect(page.getByTestId("nav-account-link")).toContainText("Променено")
  await page.reload()
  await expect(editor.getByTestId("current-info")).toContainText("Променено")
  await page.goto("/vhod/adresi")
  await page.getByTestId("add-address-button").click()
  const modal = page.getByTestId("add-address-modal")
  for (const [id, value] of [
    ["first-name-input", "Тест"],
    ["last-name-input", "Адрес"],
    ["address-1-input", "ул. Тестова 1"],
    ["postal-code-input", "1000"],
    ["city-input", "София"],
  ]) {
    await modal.getByTestId(id).fill(value)
  }
  await modal.getByTestId("country-select").selectOption("bg")
  await modal.getByTestId("save-button").click()
  await expect(page.getByTestId("address-container")).toHaveCount(1)
  await page.getByTestId("address-edit-button").click()
  const editModal = page.getByTestId("edit-address-modal")
  await editModal.getByTestId("address-1-input").fill("ул. Тестова 2")
  await editModal.getByTestId("save-button").click()
  await expect(page.getByTestId("address-address")).toContainText(
    "ул. Тестова 2",
  )
  await page.reload()
  await expect(page.getByTestId("address-address")).toContainText(
    "ул. Тестова 2",
  )
  await page.getByTestId("address-delete-button").click()
  await expect(page.getByTestId("address-container")).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId("address-container")).toHaveCount(0)
})

test("password reset uses real SMTP link; old password fails and new password works", async ({
  page,
  request,
}) => {
  const email = "reset@example.invalid"
  await activate(page, request, email)
  await logout(page)
  await page.goto("/zabravena-parola")
  await page.getByTestId("password-reset-email-input").fill(email)
  await page.getByRole("button", { name: "Изпрати линк" }).click()
  await expect(page.getByTestId("password-reset-request-success")).toBeVisible()
  const link = await mailLink(request, email, "/nova-parola")
  await page.goto(link)
  await expect(page).toHaveURL(/\/nova-parola$/)
  await page.getByLabel(/^Нова парола/).fill("Updated-synthetic-password-456!")
  await page
    .getByLabel("Повторете паролата")
    .fill("Updated-synthetic-password-456!")
  await page.getByRole("button", { name: "Запази новата парола" }).click()
  await expect(page.getByRole("status")).toContainText(
    "Паролата е сменена успешно",
  )
  await login(page, email)
  await expect(page.getByTestId("login-error-message")).toBeVisible()
  await login(page, email, "Updated-synthetic-password-456!")
  await expect(page.getByTestId("nav-account-link")).toContainText("Тест")
})

test("guest completes test checkout and returns to an empty cart", async ({
  page,
}) => {
  await addBottle(page)
  await checkout(page, "guest-order@example.invalid")
})

test("registration keeps the guest cart and signed-in checkout appears in order history", async ({
  page,
  request,
}) => {
  const email = "customer-order@example.invalid"
  await addBottle(page)
  await activate(page, request, email)
  await page.goto("/koshnitsa")
  await expect(page.getByTestId("product-row")).toHaveCount(1)
  await checkout(page, email)
  await page.goto("/vhod/porachki")
  await expect(page.getByTestId("order-card")).toHaveCount(1)
  await logout(page)
  await page.goto("/vhod/porachki")
  await expect(page.getByTestId("login-page")).toBeVisible()
})

test("mobile catalog, favorites and cart stay within the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/parfyumi")
  await expect(page.getByTestId("product-wrapper")).toHaveCount(2)
  await card(page, "Amber")
    .getByRole("button", { name: "Добави в любими" })
    .click()
  await page.goto("/lyubimi")
  await expect(page.getByRole("article")).toHaveCount(1)
  await page.getByRole("article").getByRole("link").click()
  await page.getByTestId("add-product-button").click()
  await expect(page.getByTestId("add-product-button")).toBeEnabled()
  await page.goto("/koshnitsa")
  await expect(page.getByTestId("product-row")).toHaveCount(1)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})
