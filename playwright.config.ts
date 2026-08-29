import { defineConfig, devices } from "@playwright/test"

const port = process.env.PLAYWRIGHT_PORT || "3000"
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: "./e2e",
  // `.e2e.ts` uzantısı bilinçli: Playwright'ın varsayılan `*.spec.ts` deseni
  // `bun test`in de topladığı bir desen — aynı dosyayı iki koşucu birden alınca
  // `bun test` "Playwright Test did not expect test() to be called here" ile
  // patlıyor ve quality kapısını kırıyordu. Birim testleri `*.test.ts`,
  // uçtan uca testler `*.e2e.ts`.
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  // Satış kabul fixture'ı paylaşılan DEV/CI test veritabanında geçici lead,
  // workshop ve kullanıcılar oluşturur. Dosyaları paralel çalıştırmak diğer
  // veri-okuyan smoke testlerine bu satırları sızdırır; tek worker izolasyonu
  // teardown tamamlanmadan sonraki dosyanın başlamamasını garanti eder.
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
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
    command: `bun run dev -- -p ${port}`,
    url: `${baseURL}/api/health`,
    env: {
      EMAIL_PROVIDER: "mock",
      SMS_PROVIDER: "mock",
      WHATSAPP_PROVIDER: "mock",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
