import { expect, test } from "bun:test"
import {
  buildCredentialsWhatsAppText,
  renderCredentialsCardHtml,
  type MemberCredentials,
} from "./credential-card"

function credentials(over: Partial<MemberCredentials> = {}): MemberCredentials {
  return {
    workshopName: "Şahin Oto Servis",
    loginCode: "sahin-oto-servis",
    loginUrl: "https://bakimx.com/login",
    fullName: "Mehmet Yılmaz",
    username: "mehmet.yilmaz",
    tempPassword: "K7RM-3TQX",
    ...over,
  }
}

test("WhatsApp metni girişe gereken üç bilgiyi de taşır", () => {
  const text = buildCredentialsWhatsAppText(credentials())
  // Kullanıcı adı yolu tenant'sız çözülemez — kod olmadan mesaj işe yaramaz.
  expect(text).toContain("sahin-oto-servis")
  expect(text).toContain("mehmet.yilmaz")
  expect(text).toContain("K7RM-3TQX")
  expect(text).toContain("https://bakimx.com/login")
})

test("WhatsApp metni ilk giriş davranışını ve mesajın silinmesini söyler", () => {
  const text = buildCredentialsWhatsAppText(credentials())
  expect(text).toContain("İlk girişte şifrenizi değiştirmeniz istenecek")
  expect(text.toLowerCase()).toContain("silin")
})

test("yazdırılabilir kart tek başına ayakta duran bir belgedir", () => {
  const html = renderCredentialsCardHtml(credentials())
  expect(html.startsWith("<!doctype html>")).toBe(true)
  expect(html).toContain('<html lang="tr">')
  expect(html).toContain("@page")
  expect(html).toContain("K7RM-3TQX")
  expect(html).toContain("mehmet.yilmaz")
  expect(html).toContain("sahin-oto-servis")
})

test("karta giren değerler HTML olarak kaçırılır", () => {
  // İş yeri adı kullanıcı girdisidir; kaçırılmazsa yazdırılan belge script taşır.
  const html = renderCredentialsCardHtml(
    credentials({ workshopName: `<script>alert("x")</script>`, fullName: "A & B" })
  )
  expect(html).not.toContain("<script>alert")
  expect(html).toContain("&lt;script&gt;")
  expect(html).toContain("A &amp; B")
})
