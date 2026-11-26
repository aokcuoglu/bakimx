import { expect, test } from "bun:test"
import { notificationTemplateFormSchema } from "./notification-template"

test("boş ve yalnız boşluktan oluşan metin reddedilir", () => {
  for (const content of ["", "   \n "]) {
    const r = notificationTemplateFormSchema.safeParse({ content })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toBe("Şablon metni boş olamaz")
  }
})

test("geçerli metin kırpılır, çok satır ve değişkenler korunur", () => {
  const r = notificationTemplateFormSchema.safeParse({ content: "  Merhaba {customerName}\nRandevunuz var  " })
  expect(r.success).toBe(true)
  if (r.success) expect(r.data.content).toBe("Merhaba {customerName}\nRandevunuz var")
})
