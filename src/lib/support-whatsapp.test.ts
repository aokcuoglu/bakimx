import { afterEach, describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { getSupportWhatsAppUrl } from "./support-whatsapp"
import { getWhatsAppSendUrl, getWhatsAppShareUrl } from "./share/whatsapp"

const previousNumber = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP
afterEach(() => {
  if (previousNumber === undefined) delete process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP
  else process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP = previousNumber
})

describe("company WhatsApp contact", () => {
  test("missing or blank configuration still targets the company, not the share picker", () => {
    for (const number of [undefined, "", "  "]) {
      if (number === undefined) delete process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP
      else process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP = number
      expect(new URL(getSupportWhatsAppUrl("Merhaba")).pathname).toBe("/905423681438")
    }
  })

  test("preserves Turkish text and reserved characters as a single message parameter", () => {
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP = "905423681438"
    const message = "Merhaba, paket etkinleştirme hakkında bilgi istiyorum. (Şişli & Oğuz #1)\nÜcret?"
    const url = new URL(getSupportWhatsAppUrl(message))
    expect(url.origin).toBe("https://wa.me")
    expect(url.pathname).toBe("/905423681438")
    expect([...url.searchParams]).toEqual([["text", message]])
    expect(url.hash).toBe("")
  })

  test("honors an explicitly configured international number", () => {
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP = " 905551112233 "
    expect(new URL(getSupportWhatsAppUrl("Merhaba")).pathname).toBe("/905551112233")
  })

  test("company configuration never redirects workshop/customer sharing", () => {
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP = "905423681438"
    expect(new URL(getWhatsAppSendUrl("0555 111 22 33", "Servis özeti")).pathname).toBe("/905551112233")
    expect(new URL(getWhatsAppShareUrl("Servis özeti")).pathname).toBe("/")
  })
})

test("Docker and both AWS workflows pass the contact number at build time", () => {
  const root = join(import.meta.dir, "../..")
  const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8")
  const beforeBuild = dockerfile.split("RUN npm run build")[0]
  expect(beforeBuild).toContain("ARG NEXT_PUBLIC_SUPPORT_WHATSAPP=905423681438")
  expect(beforeBuild).toContain("ENV NEXT_PUBLIC_SUPPORT_WHATSAPP=$NEXT_PUBLIC_SUPPORT_WHATSAPP")
  for (const environment of ["dev", "prod"]) {
    const workflow = readFileSync(join(root, `.github/workflows/deploy-${environment}-aws.yml`), "utf8")
    const buildArgs = workflow.split("build-args: |")[1]?.split(/\n\s*- name:/)[0]
    expect(buildArgs).toContain(
      `NEXT_PUBLIC_SUPPORT_WHATSAPP=\${{ vars.${environment.toUpperCase()}_NEXT_PUBLIC_SUPPORT_WHATSAPP || '905423681438' }}`,
    )
  }
})
