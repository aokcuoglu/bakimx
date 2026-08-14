import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  // `.e2e.ts` uzantısı bilinçli: Playwright'ın varsayılan `*.spec.ts` deseni
  // `bun test`in de topladığı bir desen — aynı dosyayı iki koşucu birden alınca
  // `bun test` "Playwright Test did not expect test() to be called here" ile
  // patlıyor ve quality kapısını kırıyordu. Birim testleri `*.test.ts`,
  // uçtan uca testler `*.e2e.ts`.
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 800 } },
    },
  ],
  webServer: {
    command: "bun run dev",
    url: "http://127.0.0.1:3000/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
