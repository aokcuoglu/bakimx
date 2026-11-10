import { expect, test } from "@playwright/test"

// Read-only acceptance against the seeded local workshop; no assignment is saved.
test("technician assignment opens a centered modal and restores focus", async ({ page }, testInfo) => {
  await page.goto("/api/auth/dev-login?redirect=/orders")
  const trigger = page.getByRole("button", { name: /^Usta ata$|^Atanan usta:/ }).first()
  await expect(trigger).toBeVisible()
  const dialog = page.getByRole("dialog", { name: "Usta Ata", exact: true })

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await trigger.click()
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute("data-slot", "dialog-content")
    await expect(dialog.getByRole("button", { name: "Kapat", exact: true })).toBeVisible()
    // Wait for the opening zoom before measuring the centered panel.
    await expect.poll(async () => {
      const box = (await dialog.boundingBox())!
      return Math.abs(box.y + box.height / 2 - 450)
    }).toBeLessThan(2)
    const box = (await dialog.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(15)
    expect(box.x + box.width).toBeLessThanOrEqual(width - 15)
    expect(box.y).toBeGreaterThanOrEqual(15)
    expect(box.y + box.height).toBeLessThanOrEqual(885)
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)

    const search = dialog.getByRole("textbox", { name: "Usta ara" })
    if (await search.count()) {
      await search.fill("no-match-modal-qa")
      await expect(dialog.getByText(/ile eşleşen usta yok/)).toBeVisible()
      await search.fill("")
    }
    await dialog.screenshot({ path: testInfo.outputPath(`technician-modal-${width}.png`), animations: "disabled" })
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  }

  await trigger.click()
  await dialog.getByRole("button", { name: "Kapat", exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})
