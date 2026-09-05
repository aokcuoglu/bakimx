import { expect, test } from "@playwright/test"

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { randomUUID } from "node:crypto"
import AxeBuilder from "@axe-core/playwright"

const db = new PrismaClient({ adapter: new PrismaPg(new Pool({connectionString:process.env.DATABASE_URL})) })
let workshopId: string, orderId: string, email: string

test.beforeAll(async()=>{
  if(process.env.NODE_ENV === "production" || !process.env.DATABASE_URL) throw new Error("Explicit non-production database required")
  const prefix=`damage-ui-${randomUUID()}`
  const workshop=await db.workshop.create({data:{loginCode:randomUUID(),name:prefix,phone:"05550000000",city:"İstanbul",address:"QA",approvalStatus:"approved",subscriptionStatus:"active",planTier:"premium"}})
  workshopId=workshop.id;email=`${prefix}@example.com`
  await db.user.create({data:{workshopId,email,password:"unusable-qa-password",role:"owner",firstName:"QA"}})
  const customer=await db.customer.create({data:{workshopId,firstName:"QA",lastName:"Hasar",phone:"05550000000"}})
  const vehicle=await db.vehicle.create({data:{workshopId,customerId:customer.id,plate:"QA UI 603",brand:"QA",model:"Test"}})
  const intake=await db.vehicleIntakeForm.create({data:{workshopId,customerId:customer.id,vehicleId:vehicle.id,customerComplaint:"UI test"}})
  orderId=(await db.serviceOrder.create({data:{workshopId,intakeFormId:intake.id}})).id
})
test.afterAll(async()=>{
  if(workshopId){
    const where={workshopId}
    await db.auditLog.deleteMany({where});await db.serviceOrder.deleteMany({where});await db.vehicleIntakeForm.deleteMany({where});await db.vehicle.deleteMany({where});await db.customer.deleteMany({where});await db.user.deleteMany({where});await db.workshop.delete({where:{id:workshopId}})
  }
  await db.$disconnect()
})

// The work-order shell is real; isolate damage API writes so this acceptance
// test never changes the user's seeded records.
test("damage cards reload, preserve numbering, edit multiple marks and require explicit inspection", async ({ page }) => {
  let marks = [{ id:"qa-7", number:7, zone:"hood", damageType:"scratch", severity:"light", note:"Mevcut çizik",photoIds:[] as string[] }]
  let inspectionStatus = "not_recorded"
  let bodyType = "sedan"
  await page.route("**/api/intakes/damage*", async route => {
    const method = route.request().method()
    if (method === "GET") return route.fulfill({json:{marks,inspectionStatus,bodyType,inspectedAt:null,photos:[]}})
    if (method === "DELETE") {marks = marks.filter(m=>m.id!==new URL(route.request().url()).searchParams.get("id"));return route.fulfill({json:{success:true}})}
    const data = route.request().postDataJSON()
    if (!data.zone) { bodyType=data.bodyType || bodyType;inspectionStatus=data.inspectionStatus || inspectionStatus;return route.fulfill({json:{success:true}}) }
    const mark = {...data,id:data.id || "qa-8",number:data.id ? 7 : 8}
    marks = data.id ? marks.map(m=>m.id===data.id ? mark : m) : [...marks,mark]
    inspectionStatus="not_recorded"
    return route.fulfill({json:{success:true,mark}})
  })
  await page.goto(`/api/auth/dev-login?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(`/orders/${orderId}?tab=kanit`)}`)
  await expect(page.getByText("#7 · Kaput",{exact:true})).toBeVisible()
  await expect(page.getByText("Fotoğraf eklenmedi",{exact:true})).toBeVisible()
  const hood=page.getByRole("button",{name:"Kaput — hasar ekle",exact:true})
  await hood.focus()
  await expect(hood).toBeFocused()
  await page.keyboard.press("Enter")
  await page.getByLabel("Not",{exact:true}).fill("İkinci hasar")
  await page.getByRole("button",{name:"Hasarı Kaydet",exact:true}).click()
  await expect(page.getByText("#8 · Kaput",{exact:true})).toBeVisible()
  await page.reload()
  await expect(page.getByText("#8 · Kaput",{exact:true})).toBeVisible()
  for (const body of ["SUV","Hafif ticari","Binek"]) {
    await page.getByRole("combobox",{name:"Araç şeması"}).click()
    await page.getByRole("option",{name:body,exact:true}).click()
    for (const view of ["Ön","Arka","Sol","Sağ","Üst"]) {
      await page.getByRole("tab",{name:view,exact:true}).click()
      await expect(page.getByRole("group",{name:`${view} araç görünüşü`})).toBeVisible()
    }
  }
  await page.locator('[data-damage-number="7"]').getByRole("button",{name:"Düzenle"}).click()
  await page.getByLabel("Not",{exact:true}).fill("Düzenlenmiş hasar")
  await page.getByRole("button",{name:"Hasarı Kaydet",exact:true}).click()
  await expect(page.getByText("Düzenlenmiş hasar",{exact:true})).toBeVisible()
  for (const theme of ["light","dark"]) {
    await page.evaluate(t=>document.documentElement.classList.toggle("dark",t==="dark"),theme)
    await expect.poll(()=>page.getByRole("combobox",{name:"Araç şeması"}).evaluate(e=>getComputedStyle(e).color===getComputedStyle(e.parentElement!).color)).toBe(true)
    const a11y=await new AxeBuilder({page}).include('[data-testid="damage-capture"]').withTags(["wcag2a","wcag2aa"]).analyze()
    expect(a11y.violations,`${theme} full damage capture accessibility`).toEqual([])
    for(const width of [360,1440]) {
      await page.setViewportSize({width,height:1000})
      await page.getByTestId("damage-capture").screenshot({path:`/tmp/damage603-populated-${width}-${theme}.png`,animations:"disabled"})
      const overflow=await page.locator('[data-damage-number="7"]').evaluate(e=>e.scrollWidth-e.clientWidth)
      expect(overflow).toBeLessThanOrEqual(1)
    }
  }
  for (const number of [7,8]) {
    await page.locator(`[data-damage-number="${number}"]`).getByRole("button",{name:"Kaldır",exact:true}).click()
    await page.getByRole("button",{name:"İşareti Kaldır",exact:true}).click()
  }
  await expect(page.getByText("Kontrol kaydı yok",{exact:true})).toBeVisible()
  await page.getByRole("button",{name:"Kontrol edildi, görünür hasar gözlenmedi",exact:true}).click()
  await expect(page.getByText("Kontrol edildi, görünür hasar gözlenmedi",{exact:false}).last()).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
})
