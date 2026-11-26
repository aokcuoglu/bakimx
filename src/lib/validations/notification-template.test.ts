import { expect, test } from "bun:test"
import { notificationTemplateFormSchema } from "./notification-template"

test("boş ve yalnız boşluktan oluşan metin reddedilir", () => {
  for (const content of ["", "   \n "]) {
    const r = notificationTemplateFormSchema.safeParse({ content })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toBe("Şablon metni boş olamaz")
  }
})

test("geçerli metin olduğu gibi geçer (baş/son satır sonu dahil)", () => {
  const r = notificationTemplateFormSchema.safeParse({ content: "\n  Merhaba {customerName}\nRandevunuz var  \n" })
  expect(r.success).toBe(true)
  if (r.success) expect(r.data.content).toBe("\n  Merhaba {customerName}\nRandevunuz var  \n")
})
