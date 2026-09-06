import { defineConfig } from "@playwright/test"
import base from "./playwright.config"

/** Focused touch/keyboard regression gate for the damage and photo editors. */
export default defineConfig({
  ...base,
  testMatch: ["**/damage-records.e2e.ts", "**/photo-annotations.e2e.ts"],
  projects: [
    { name: "damage-chromium", use: { browserName: "chromium", viewport: { width: 360, height: 800 }, hasTouch: true } },
    { name: "damage-webkit", use: { browserName: "webkit", viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true } },
  ],
})
