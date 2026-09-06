import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test"
import {
  cleanupSalesE2EFixture,
  disconnectSalesE2EFixture,
  salesE2EPrisma,
  setupSalesE2EFixture,
  type SalesE2EFixture,
} from "./helpers/sales-e2e-fixture"

test.use({ viewport: { width: 1440, height: 1000 } })
test.describe.configure({ mode: "serial" })
test.setTimeout(180_000)

let fixture: SalesE2EFixture | null = null
let invitedAdvisorId: string | null = null
let convertedLeadId: string | null = null
let usedRegistrationUrl: string | null = null
const localBaseURL = `http://localhost:${process.env.PLAYWRIGHT_PORT || "3000"}`

async function localContext(browser: Browser) {
  return browser.newContext({ baseURL: localBaseURL })
}

async function devLogin(browser: Browser, email: string, redirect = "/admin/sales") {
  const context = await localContext(browser)
  const page = await context.newPage()
  await page.goto(`/api/auth/dev-login?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(redirect)}`)
  return { context, page }
}

async function passwordLogin(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.getByLabel("E-posta veya kullanıcı adı", { exact: true }).fill(email)
  await page.getByLabel("Şifre", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Giriş Yap", exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/sales(?:\?.*)?$/)
}

async function expectNotFound(page: Page, path: string) {
  const response = await page.context().request.get(path)
  expect(response.status(), `${path} 404 dönmeli`).toBe(404)
}

async function closeContexts(...contexts: Array<BrowserContext | null | undefined>) {
  await Promise.all(contexts.filter(Boolean).map((context) => context!.close()))
}

test.beforeAll(async () => {
  fixture = await setupSalesE2EFixture()
})

test.afterAll(async () => {
  try {
    await cleanupSalesE2EFixture(fixture)
  } finally {
    await disconnectSalesE2EFixture()
  }
})

test("founder, support, finance, readonly ve advisor satış yetki matrisi", async ({ browser }) => {
  if (!fixture) throw new Error("Fixture hazırlanmadı.")
  let founderContext: BrowserContext | null = null
  let supportContext: BrowserContext | null = null
  let financeContext: BrowserContext | null = null
  let readonlyContext: BrowserContext | null = null
  let advisorContext: BrowserContext | null = null

  try {
    const founder = await devLogin(browser, fixture.founderEmail)
    founderContext = founder.context
    await expect(founder.page.getByRole("heading", { name: "Satış operasyon merkezi" })).toBeVisible()
    await expect(founder.page.getByRole("button", { name: "Yeni şirket adayı" })).toBeVisible()
    await founder.page.goto("/admin/sales/advisors")
    await expect(founder.page.getByRole("heading", { name: "Satış Danışmanları" })).toBeVisible()
    await founder.page.goto("/admin/sales/commissions")
    await expect(founder.page.getByRole("heading", { name: "Hakediş ledger’ı" })).toBeVisible()
    await founderContext.close()
    founderContext = null

    const support = await devLogin(browser, fixture.roleEmails.support)
    supportContext = support.context
    await expect(support.page.getByRole("button", { name: "Yeni şirket adayı" })).toBeVisible()
    await expectNotFound(support.page, "/admin/sales/advisors")
    await expectNotFound(support.page, "/admin/sales/commissions")
    await supportContext.close()
    supportContext = null

    const finance = await devLogin(browser, fixture.roleEmails.finance)
    financeContext = finance.context
    await expect(finance.page.getByRole("heading", { name: "Satış operasyon merkezi" })).toBeVisible()
    await expect(finance.page.getByRole("button", { name: "Yeni şirket adayı" })).toHaveCount(0)
    await finance.page.goto("/admin/sales/commissions")
    await expect(finance.page.getByRole("heading", { name: "Hakediş ledger’ı" })).toBeVisible()
    await finance.page.goto("/admin/sales/settings")
    await expect(finance.page.getByRole("heading", { name: /Hakediş kuralları/i })).toBeVisible()
    await expectNotFound(finance.page, "/admin/sales/advisors")
    await financeContext.close()
    financeContext = null

    const readonly = await devLogin(browser, fixture.roleEmails.readonly)
    readonlyContext = readonly.context
    await expect(readonly.page.getByRole("heading", { name: "Satış operasyon merkezi" })).toBeVisible()
    await expect(readonly.page.getByRole("button", { name: "Yeni şirket adayı" })).toHaveCount(0)
    await readonly.page.goto("/admin/sales/performance")
    await expect(readonly.page.getByRole("heading", { name: "Satış performansı" })).toBeVisible()
    await expectNotFound(readonly.page, "/admin/sales/commissions")
    await expectNotFound(readonly.page, "/admin/sales/advisors")
    await readonlyContext.close()
    readonlyContext = null

    const advisor = await devLogin(browser, fixture.advisorBEmail)
    advisorContext = advisor.context
    await expect(advisor.page).toHaveURL(/\/admin\/sales$/)
    await expect(advisor.page.getByRole("heading", { name: "Satış operasyon merkezi" })).toBeVisible()
    await expect(advisor.page.getByRole("button", { name: "Yeni şirket adayı" })).toBeVisible()
    await advisor.page.goto("/admin/sales/commissions")
    await expect(advisor.page.getByRole("heading", { name: "Hakediş ledger’ı" })).toBeVisible()
    await expect(advisor.page.getByRole("button", { name: "Hakedişi onayla" })).toHaveCount(0)
    await expectNotFound(advisor.page, "/admin/sales/settings")
    await expectNotFound(advisor.page, "/admin/sales/advisors")
    await advisorContext.close()
    advisorContext = null
  } finally {
    await closeContexts(founderContext, supportContext, financeContext, readonlyContext, advisorContext)
  }
})

test("davetten kayıt, ödeme, hakediş ve performansa satış yaşam döngüsü", async ({ browser }) => {
  if (!fixture) throw new Error("Fixture hazırlanmadı.")
  let founderContext: BrowserContext | null = null
  let advisorContext: BrowserContext | null = null
  let registrationContext: BrowserContext | null = null
  let financeContext: BrowserContext | null = null

  const businessName = `${fixture.prefix} müşteri servisi`
  const taskNote = `${fixture.prefix} ilk takip`
  const activitySummary = `${fixture.prefix} telefon görüşmesi tamamlandı`

  try {
    const founder = await devLogin(browser, fixture.founderEmail, "/admin/sales/advisors")
    founderContext = founder.context
    const inviteForm = founder.page.locator("form").filter({ has: founder.page.getByRole("button", { name: "Davet gönder" }) })
    await inviteForm.getByLabel("Ad", { exact: true }).fill("E2E")
    await inviteForm.getByLabel("Soyad", { exact: true }).fill("Danışman A")
    await inviteForm.getByLabel("E-posta", { exact: true }).fill(fixture.invitedAdvisorEmail)
    await inviteForm.getByRole("button", { name: "Davet gönder" }).click()
    await expect(founder.page.getByText(/davet.*oluşturuldu/i)).toBeVisible()
    const inviteUrlNode = founder.page.locator("p").filter({ hasText: "/invite/sales/" }).last()
    await expect(inviteUrlNode).toBeVisible()
    const inviteUrl = (await inviteUrlNode.textContent())?.trim()
    if (!inviteUrl) throw new Error("Davet URL'si arayüzde bulunamadı.")

    advisorContext = await localContext(browser)
    const advisorPage = await advisorContext.newPage()
    await advisorPage.goto(inviteUrl)
    await expect(advisorPage.getByRole("heading", { name: "Satış hesabınızı oluşturun" })).toBeVisible()
    await advisorPage.getByLabel("Şifre", { exact: true }).fill(fixture.password)
    await advisorPage.getByLabel("Şifre (tekrar)", { exact: true }).fill(fixture.password)
    await advisorPage.getByRole("button", { name: "Hesabımı oluştur" }).click()
    await expect(advisorPage).toHaveURL(/\/login\?advisorInvited=1$/)
    await expect(advisorPage.getByText("Satış hesabınız oluşturuldu.")).toBeVisible()

    const usedInvitePage = await advisorContext.newPage()
    await usedInvitePage.goto(inviteUrl)
    await expect(usedInvitePage.getByRole("heading", { name: "Davet kullanılmış" })).toBeVisible()
    await usedInvitePage.close()

    invitedAdvisorId = await expect.poll(async () => {
      const advisor = await salesE2EPrisma.salesAdvisor.findFirst({
        where: { user: { email: fixture!.invitedAdvisorEmail } },
        select: { id: true },
      })
      return advisor?.id ?? null
    }).not.toBeNull().then(async () => {
      const advisor = await salesE2EPrisma.salesAdvisor.findFirstOrThrow({
        where: { user: { email: fixture!.invitedAdvisorEmail } },
        select: { id: true },
      })
      return advisor.id
    })

    await passwordLogin(advisorPage, fixture.invitedAdvisorEmail, fixture.password)
    await expect(advisorPage.getByRole("heading", { name: "Satış operasyon merkezi" })).toBeVisible()

    await founder.page.goto("/admin/sales")
    await founder.page.getByRole("button", { name: "Yeni şirket adayı" }).click()
    const leadDialog = founder.page.getByRole("dialog", { name: "Yeni şirket adayı" })
    await leadDialog.getByLabel("Şirket / servis adı", { exact: true }).fill(businessName)
    await leadDialog.getByLabel("Yetkili", { exact: true }).fill("Müşteri Sahibi")
    await leadDialog.getByLabel("Telefon", { exact: true }).fill("0532 573 2026")
    await leadDialog.getByLabel("E-posta", { exact: true }).fill(fixture.customerOwnerEmail)
    await leadDialog.getByLabel("Aylık araç hacmi", { exact: true }).fill("80")
    await leadDialog.getByLabel("İl", { exact: true }).fill("İstanbul")
    await leadDialog.getByLabel("İlçe", { exact: true }).fill("Kadıköy")
    await leadDialog.getByLabel("Adres özeti / tarif", { exact: true }).fill("Koşuyolu Mah. E2E Sok. No: 573")
    await leadDialog.getByLabel("İlk izlenim / not", { exact: true }).fill("Playwright satış kabul adayı")
    await leadDialog.getByRole("button", { name: "Portföye ekle" }).click()
    await expect(founder.page.getByText("Servis adayı satış havuzuna eklendi.")).toBeVisible()

    convertedLeadId = await expect.poll(async () => {
      const lead = await salesE2EPrisma.salesLead.findFirst({
        where: { businessName },
        select: { id: true, advisorId: true },
      })
      return lead ? `${lead.id}:${lead.advisorId ?? "unassigned"}` : null
    }).toMatch(/:unassigned$/).then(async () => {
      const lead = await salesE2EPrisma.salesLead.findFirstOrThrow({ where: { businessName }, select: { id: true } })
      return lead.id
    })

    await founder.page.goto(`/admin/sales/leads/${convertedLeadId}`)
    const assignmentSection = founder.page.locator("section").filter({ hasText: "Danışman ataması" })
    await assignmentSection.getByLabel("Danışman", { exact: true }).click()
    await founder.page.getByRole("option", { name: "E2E Danışman A", exact: true }).click()
    await assignmentSection.getByRole("button", { name: "Ata / devret" }).click()
    await expect(founder.page.getByText("Danışman ataması güncellendi.")).toBeVisible()
    await expect(founder.page.getByText("Atanmamış → E2E Danışman A")).toBeVisible()

    await advisorPage.goto(`/admin/sales/leads/${convertedLeadId}`)
    await expect(advisorPage.getByRole("heading", { name: businessName })).toBeVisible()
    const taskSection = advisorPage.locator("section").filter({ hasText: "Satış görevleri" })
    await taskSection.getByLabel("Not", { exact: true }).fill(taskNote)
    await taskSection.getByRole("button", { name: "Görev ekle" }).click()
    await expect(advisorPage.getByText("Görev planlandı.")).toBeVisible()
    const taskCard = taskSection.locator("article").filter({ hasText: taskNote })
    await expect(taskCard).toBeVisible()
    await taskCard.getByRole("button", { name: "Görüşmeyle tamamla" }).click()

    const activitySection = advisorPage.locator("section#activity-form")
    await activitySection.getByLabel("Sonuç", { exact: true }).click()
    await advisorPage.getByRole("option", { name: "Ulaşıldı", exact: true }).click()
    await activitySection.getByLabel("Görüşme özeti", { exact: true }).fill(activitySummary)
    await activitySection.getByRole("button", { name: "Görüşmeyi kaydet" }).click()
    await expect(advisorPage.getByText("Görüşme ve bağlı görevler kaydedildi.")).toBeVisible()
    await expect(advisorPage.getByText(activitySummary)).toBeVisible()
    await expect(taskSection.locator("article").filter({ hasText: taskNote }).getByText("Tamamlandı")).toBeVisible()

    await advisorPage.getByRole("button", { name: "Kayıt bağlantısı oluştur" }).click()
    await expect(advisorPage.getByText("Kayıt bağlantısı oluşturuldu ve panoya kopyalandı.")).toBeVisible()
    usedRegistrationUrl = await advisorPage.getByLabel("Müşteri kayıt bağlantısı").inputValue()
    expect(usedRegistrationUrl).toContain("/register/sales/")

    registrationContext = await localContext(browser)
    const registrationPage = await registrationContext.newPage()
    await registrationPage.goto(usedRegistrationUrl)
    await expect(registrationPage.getByRole("heading", { name: "Sektörünüzü seçin" })).toBeVisible()
    await registrationPage.getByRole("radio", { name: /Oto Servis/ }).click()
    await registrationPage.getByRole("button", { name: "Devam Et" }).click()
    await registrationPage.getByRole("button", { name: "Devam Et" }).click()
    await registrationPage.getByRole("radio", { name: /Sadece Ben/ }).click()
    await registrationPage.getByRole("button", { name: "Devam Et" }).click()
    await registrationPage.getByRole("button", { name: "Devam Et" }).click()
    await expect(registrationPage.getByRole("heading", { name: "Hesap bilgileriniz" })).toBeVisible()
    await expect(registrationPage.getByText("Bu kayıt E2E Danışman A tarafından size özel oluşturuldu.")).toBeVisible()
    await registrationPage.getByLabel("Şifre *", { exact: true }).fill(fixture.password)
    await registrationPage.getByLabel("Şifre tekrar *", { exact: true }).fill(fixture.password)
    await registrationPage.getByLabel("Aydınlatma metni onayı").click()
    await registrationPage.getByRole("button", { name: "Ücretsiz Hesabımı Oluştur" }).click()
    await expect(registrationPage.getByRole("heading", { name: "E-postanızı kontrol edin" })).toBeVisible({ timeout: 30_000 })

    const conversion = await expect.poll(async () => {
      return salesE2EPrisma.salesLead.findUnique({
        where: { id: convertedLeadId! },
        select: {
          status: true,
          advisorId: true,
          workshopId: true,
          attributionFrozenAt: true,
          workshop: {
            select: {
              name: true,
              acquisitionSource: true,
              acquisitionAdvisorId: true,
              users: { where: { email: fixture!.customerOwnerEmail }, select: { id: true, role: true } },
            },
          },
          registrationLinks: {
            where: { usedAt: { not: null } },
            select: { usedAt: true, workshopId: true },
          },
        },
      })
    }).toMatchObject({ status: "won", advisorId: invitedAdvisorId }).then(() =>
      salesE2EPrisma.salesLead.findUniqueOrThrow({
        where: { id: convertedLeadId! },
        select: { workshopId: true, workshop: { select: { name: true } } },
      }),
    )
    expect(conversion.workshopId).not.toBeNull()
    expect(conversion.workshop?.name).toBe(businessName)

    const founderUser = await salesE2EPrisma.user.findUniqueOrThrow({
      where: { email: fixture.founderEmail },
      select: { id: true },
    })
    const rule = await salesE2EPrisma.salesCommissionRule.create({
      data: {
        planTier: "pro",
        billingCycle: "monthly",
        rateBps: 1_000,
        effectiveFrom: new Date(Date.now() - 60_000),
        createdById: founderUser.id,
      },
    })
    fixture.commissionRuleId = rule.id
    const reference = `${fixture.prefix}-PAY`.toUpperCase()
    await salesE2EPrisma.billingOrder.create({
      data: {
        workshopId: conversion.workshopId!,
        type: "new_purchase",
        planTier: "pro",
        previousPlanTier: null,
        billingCycle: "monthly",
        amountMinor: 12_000,
        vatRateBps: 2_000,
        grossAmountMinor: 12_000,
        netAmountMinor: 10_000,
        status: "pending_payment",
        method: "havale",
        reference,
      },
    })

    await founder.page.goto("/admin/billing")
    const paymentCard = founder.page.locator("div.rounded-lg.border.bg-card.p-4").filter({ hasText: reference })
    await expect(paymentCard).toContainText(businessName)
    await paymentCard.getByRole("button", { name: "Havale alındı" }).click()
    await expect(founder.page.getByText("Ödeme onaylandı")).toBeVisible()
    await expect.poll(async () => {
      const order = await salesE2EPrisma.billingOrder.findUnique({ where: { reference }, select: { status: true } })
      return order?.status
    }).toBe("confirmed")
    await expect.poll(async () => {
      const commission = await salesE2EPrisma.salesCommission.findFirst({
        where: { billingOrder: { reference } },
        select: { status: true, calculationBaseMinor: true, calculationRateBps: true, calculatedAmountMinor: true },
      })
      return commission
    }).toMatchObject({ status: "draft", calculationBaseMinor: 10_000, calculationRateBps: 1_000, calculatedAmountMinor: 1_000 })

    const finance = await devLogin(browser, fixture.roleEmails.finance, "/admin/sales/commissions")
    financeContext = finance.context
    let commissionCard = finance.page.locator('[data-slot="card"]').filter({ hasText: reference })
    await expect(commissionCard).toContainText(businessName)
    await commissionCard.getByRole("button", { name: "Hakedişi onayla" }).click()
    await expect(finance.page.getByText("Hakediş onaylandı.")).toBeVisible()
    await expect.poll(async () => {
      const commission = await salesE2EPrisma.salesCommission.findFirst({ where: { billingOrder: { reference } }, select: { status: true } })
      return commission?.status
    }).toBe("approved")
    commissionCard = finance.page.locator('[data-slot="card"]').filter({ hasText: reference })
    await commissionCard.getByRole("button", { name: "Ödendi işaretle" }).click()
    await expect(finance.page.getByText("Hakediş ödendi olarak işaretlendi.")).toBeVisible()
    await expect.poll(async () => {
      const commission = await salesE2EPrisma.salesCommission.findFirst({ where: { billingOrder: { reference } }, select: { status: true } })
      return commission?.status
    }).toBe("paid")

    await advisorPage.goto("/admin/sales/commissions")
    const advisorCommission = advisorPage.locator('[data-slot="card"]').filter({ hasText: reference })
    await expect(advisorCommission).toContainText("Ödenmiş")
    await expect(advisorCommission.getByRole("button", { name: /Hakedişi onayla|Ödendi işaretle/ })).toHaveCount(0)
    await advisorPage.goto("/admin/sales/performance")
    await expect(advisorPage.getByRole("heading", { name: "Satış performansı" })).toBeVisible()
    await expect(advisorPage.getByText("KDV hariç net satış").first()).toBeVisible()
  } finally {
    await closeContexts(founderContext, advisorContext, registrationContext, financeContext)
  }
})

test("süresi dolmuş, iptal, kullanılmış token ve çapraz danışman erişimi reddedilir", async ({ browser }) => {
  if (!fixture || !convertedLeadId || !usedRegistrationUrl) throw new Error("Yaşam döngüsü testi tamamlanmadı.")
  const publicContext = await localContext(browser)
  let advisorAContext: BrowserContext | null = null
  let advisorBContext: BrowserContext | null = null

  try {
    const page = await publicContext.newPage()
    await page.goto(`/register/sales/${fixture.expiredRegistrationToken}`)
    await expect(page.getByRole("heading", { name: "Kayıt bağlantısının süresi dolmuş" })).toBeVisible()
    await page.goto(`/register/sales/${fixture.revokedRegistrationToken}`)
    await expect(page.getByRole("heading", { name: "Kayıt bağlantısı iptal edilmiş" })).toBeVisible()
    await page.goto(usedRegistrationUrl)
    await expect(page.getByRole("heading", { name: "Kayıt bağlantısı kullanılmış" })).toBeVisible()
    await page.goto("/register/sales/gecersiz-e2e-token")
    await expect(page.getByRole("heading", { name: "Geçersiz kayıt bağlantısı" })).toBeVisible()

    const advisorA = await devLogin(browser, fixture.invitedAdvisorEmail)
    advisorAContext = advisorA.context
    await expectNotFound(advisorA.page, `/admin/sales/leads/${fixture.advisorBLeadId}`)

    const advisorB = await devLogin(browser, fixture.advisorBEmail)
    advisorBContext = advisorB.context
    await expectNotFound(advisorB.page, `/admin/sales/leads/${convertedLeadId}`)
  } finally {
    await closeContexts(publicContext, advisorAContext, advisorBContext)
  }
})
