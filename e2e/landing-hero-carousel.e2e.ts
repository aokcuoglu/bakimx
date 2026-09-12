import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("hero tabs preserve the message, links and keyboard selection", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);

  const hero = page.locator("#hero");
  const heading = hero.getByRole("heading", { level: 1 });
  const message = await heading.textContent();
  const first = hero.getByRole("tab", { name: "Ruhsat okuma" });
  await hero.getByRole("tab", { name: "Parça bulma" }).click();
  await expect(hero.getByRole("tab", { name: "Parça bulma" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await first.click();
  await expect(first).toHaveAttribute("aria-selected", "true");
  await first.focus();
  for (const name of ["Parça bulma", "İş emri"]) {
    await page.keyboard.press("ArrowRight");
    await expect(hero.getByRole("tab", { name, exact: true })).toBeFocused();
    await expect(hero.getByRole("tab", { name, exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      hero.getByRole("tabpanel", { name, exact: true }),
    ).toBeVisible();
    await expect(heading).toHaveText(message!);
  }
  await page.keyboard.press("Home");
  await expect(first).toHaveAttribute("aria-selected", "true");
  await page.waitForTimeout(7250);
  await expect(first).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(hero.locator('a[href="/fiyatlar#lite"]')).toBeVisible();
  await expect(hero.locator('a[href="#demo-form"]')).toBeVisible();
});

for (const width of [320, 390, 768, 1440]) {
  test(`two sections fit and remain accessible at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);

    for (const selector of ["#hero", "#ozellikler"]) {
      const section = page.locator(selector);
      for (const tab of await section.getByRole("tab").all()) {
        await tab.click();
        const panel = section.getByRole("tabpanel");
        await expect(panel).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - innerWidth,
          ),
        ).toBeLessThanOrEqual(1);
        const image = panel.locator("img").first();
        await image.scrollIntoViewIfNeeded();
        await expect
          .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
          .toBeGreaterThan(0);
        if (width < 1024 && selector === "#ozellikler") {
          const imageBox = await image.boundingBox();
          const listBox = await panel.locator("ul").boundingBox();
          expect(imageBox!.y).toBeLessThan(listBox!.y);
        }
        const result = await new AxeBuilder({ page })
          .include(selector)
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(result.violations).toEqual([]);
      }
    }
  });
}

test("hero clicks emit the existing marketing payloads", async ({ page }) => {
  test.skip(
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "true",
    "Run preview with analytics enabled to verify emitted events",
  );
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);

  await page.evaluate(() => {
    const events: unknown[] = [];
    (window as unknown as { heroEvents: unknown[] }).heroEvents = events;
    window.addEventListener("bakimx:analytics", (event) =>
      events.push((event as CustomEvent).detail),
    );
    document
      .querySelectorAll("#hero a")
      .forEach((link) =>
        link.addEventListener("click", (event) => event.preventDefault()),
      );
  });
  await page.locator('#hero a[href="/fiyatlar#lite"]').click();
  await page.locator('#hero a[href="#demo-form"]').click();
  const events = await page.evaluate(
    () => (window as unknown as { heroEvents: unknown[] }).heroEvents,
  );
  expect(
    events.filter((event) =>
      ["lite_cta_click", "demo_cta_click"].includes(
        (event as { name: string }).name,
      ),
    ),
  ).toEqual([
    expect.objectContaining({
      name: "lite_cta_click",
      params: expect.objectContaining({
        cta_location: "hero_primary",
        plan_tier: "lite",
      }),
    }),
    expect.objectContaining({
      name: "demo_cta_click",
      params: expect.objectContaining({
        cta_location: "hero_secondary",
        destination: "form",
      }),
    }),
  ]);
});
