import { expect, test } from "@playwright/test"

for (const [name, viewport] of [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
] as const) {
  test.describe(`company WhatsApp contact — ${name}`, () => {
    test.use({ viewport })

    test("opens the company recipient with the Turkish message, without sending", async ({ page, context }) => {
      const requests: { url: string; method: string }[] = []
      // Never contact WhatsApp or a real account during acceptance testing.
      await context.route("https://wa.me/**", async (route) => {
        requests.push({ url: route.request().url(), method: route.request().method() })
        await route.fulfill({ contentType: "text/html", body: "<p>WhatsApp link intercepted for QA</p>" })
      })

      const response = await page.goto("/fiyatlar")
      expect(response?.ok()).toBe(true)
      const contact = page.getByRole("link", { name: "WhatsApp ile iletişim", exact: true })
      await expect(contact).toBeVisible()
      const href = await contact.getAttribute("href")
      const url = new URL(href!)
      expect(url.origin).toBe("https://wa.me")
      expect(url.pathname).toBe("/905423681438")
      expect([...url.searchParams]).toEqual([
        ["text", "Merhaba, BakimX paket etkinleştirme hakkında bilgi almak istiyorum."],
      ])
      expect(requests).toEqual([])

      await contact.scrollIntoViewIfNeeded()
      await contact.focus()
      await expect(contact).toBeFocused()
      await page.screenshot({ path: test.info().outputPath(`support-whatsapp-${name}.png`) })
      const [popup] = await Promise.all([
        page.waitForEvent("popup"),
        name === "desktop" ? contact.press("Enter") : contact.click(),
      ])
      await popup.waitForLoadState("domcontentloaded")
      expect(requests).toEqual([{ url: href, method: "GET" }])
      await popup.close()
    })
  })
}
