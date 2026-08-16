import { test, expect } from "bun:test"
import { MASK, maskEmail, maskFreeText, maskPersonName, maskPhone, maskSerial } from "./mask"

test("maskPersonName: her kelimenin yalnız ilk harfi kalır", () => {
  expect(maskPersonName("Okan Türkyılmaz")).toBe(`O${MASK} T${MASK}`)
  expect(maskPersonName("TECHPOL OTOMOTİV A.Ş.")).toBe(`T${MASK} O${MASK} A${MASK}`)
})

test("maskPersonName: maske, ismin uzunluğunu sızdırmaz", () => {
  // İki farklı uzunlukta ama aynı baş harfli isim AYNI maskeyi vermeli.
  expect(maskPersonName("Ali Veli")).toBe(maskPersonName("Abdurrahman Velioğulları"))
})

test("maskPersonName: boş / bilinmeyen ad tamamen maskelenir", () => {
  expect(maskPersonName("")).toBe(MASK)
  expect(maskPersonName(null)).toBe(MASK)
  expect(maskPersonName("   ")).toBe(MASK)
})

test("maskPhone: yalnız son 2 rakam kalır", () => {
  expect(maskPhone("0532 111 22 45")).toBe(`${MASK} 45`)
  expect(maskPhone("+90 532 111 22 45")).toBe(`${MASK} 45`)
  expect(maskPhone("12")).toBe(MASK)
  expect(maskPhone(null)).toBe(MASK)
})

test("maskEmail: yerel kısım ve alan adı gizlenir, TLD kalır", () => {
  expect(maskEmail("okan@ornek.com")).toBe(`${MASK}@${MASK}.com`)
  expect(maskEmail("a@b")).toBe(`${MASK}@${MASK}`)
  expect(maskEmail("")).toBeNull()
  expect(maskEmail(null)).toBeNull()
  expect(maskEmail("bozukadres")).toBe(MASK)
})

test("maskSerial: son 4 karakter doğrulama için kalır", () => {
  expect(maskSerial("VF7ABCDE123456789")).toBe(`${MASK}6789`)
  expect(maskSerial("1234")).toBe(MASK)
  expect(maskSerial(null)).toBeNull()
})

test("maskFreeText: dolu metin tamamen gizlenir, boş metin null kalır", () => {
  expect(maskFreeText("Akü değişecek")).toBe(MASK)
  expect(maskFreeText("")).toBeNull()
  expect(maskFreeText(null)).toBeNull()
})
