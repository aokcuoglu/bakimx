import { expect, test } from "@playwright/test"

test.describe("sidebar controls", () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test("collapses fully and preserves a resized width", async ({ page }) => {
    await page.goto("/api/auth/dev-login?redirect=/dashboard")
    await expect(page).toHaveURL(/\/dashboard/)

    const wrapper = page.locator('[data-slot="sidebar-wrapper"]')
    const gap = page.locator('[data-slot="sidebar-gap"]')
    const rail = page.getByRole("separator", { name: "Menü genişliğini değiştir" })
    const close = page.getByRole("button", { name: "Menüyü kapat" })

    await expect(gap).toHaveCSS("width", "256px")
    await expect(close).toBeVisible()
    await expect(rail).toBeVisible()
    await close.hover()
    await expect(close.locator("svg").last()).toBeVisible()

    const box = await rail.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 150)
    await page.mouse.down()
    await page.mouse.move(box!.x + box!.width / 2 + 80, box!.y + 150, { steps: 5 })
    await page.mouse.up()
    await expect(gap).toHaveCSS("width", "336px")
    await expect(rail).toHaveAttribute("aria-valuenow", "336")

    await close.click()
    await expect(wrapper).toHaveAttribute("data-sidebar-state", "collapsed")
    await expect(gap).toHaveCSS("width", "0px")
    const open = page.getByRole("button", { name: "Menüyü aç" })
    await expect(open).toBeFocused()
    await open.hover()
    await expect(open.locator("svg").last()).toBeVisible()
    await open.click()
    await expect(gap).toHaveCSS("width", "336px")
    await expect(page.getByRole("button", { name: "Menüyü kapat" })).toBeFocused()

    await page.reload()
    await expect(gap).toHaveCSS("width", "336px")
    await rail.focus()
    await page.keyboard.press("ArrowLeft")
    await expect(gap).toHaveCSS("width", "320px")
  })
})

test("mobile sidebar remains a sheet", async ({ page }) => {
  await page.goto("/api/auth/dev-login?redirect=/dashboard")
  const trigger = page.getByRole("button", { name: "Menüyü aç" })
  await trigger.click()
  await expect(page.locator('[data-mobile="true"]')).toBeVisible()
  await expect(page.locator('[data-sidebar="rail"]')).toHaveCount(0)
  await page.keyboard.press("Escape")
  await expect(page.locator('[data-mobile="true"]')).toBeHidden()
})
