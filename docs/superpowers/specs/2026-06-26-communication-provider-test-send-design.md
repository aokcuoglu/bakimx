# İletişim Sağlayıcıları — Canlıya Alma + Test Gönderimi

Tarih: 2026-06-26
Durum: Onaylandı (inline), implementasyona geçiliyor

## Bağlam

`src/lib/communications/` katmanı baştan sona kurulu: provider'lar (Netgsm SMS,
WhatsApp Business, Resend + Gmail e-posta), `sender.ts` dispatch pipeline'ı (consent
kontrolü, rate-limit, `communicationLog`), şablonlar (+UI editörü), `triggers.ts`
gerçek akışlara bağlı. `.env.example` tüm değişkenleri dokümante ediyor.

Eksik olan: hepsi `mock` modunda; gerçek bir provider'ın kredansiyelle çalışıp
çalışmadığını **doğrulamanın yolu yok**. "Devreye alma" = mock→gerçek geçiş (env,
operasyonel) + bunu doğrulayan bir test aracı (kod).

## Kapsam (onaylanan)

Env-bazlı yapı korunur. Atölye bazlı DB-config UI'ı **yapılmaz** (YAGNI). Sadece:

1. Sunucu-tarafı **test gönderim** aksiyonu.
2. Bunu çağıran API route.
3. Ayarlar panelinde kanal başına **test gönder** kontrolü + `gmail` etiket bug fix'i.

Hedef kanallar: Gmail (e-posta), Netgsm (SMS), WhatsApp Business.

## Tasarım

### 1. `sendProviderTestAction(formData)` — `settings/notifications/actions.ts`

- `requireAuth()` → `workshopId` (tenant izolasyonu; workshopId client'tan ALINMAZ).
- Girdi: `channel` ∈ {sms, whatsapp, email}, `recipient: string`.
- Doğrulama (sunucu): kanal beyaz-liste; telefon = `^\+?\d{10,15}$` (boşluk/tire
  temizlenir); e-posta = basit regex. Geçersizse `{ error }`.
- Rate-limit: `checkRateLimit(\`${workshopId}:test:${channel}\`, 5)` → kanal başına
  dk'da 5; aşılırsa `{ error: "Çok fazla test... biraz bekleyin" }`. Başarılı
  denemede `recordAttempt`.
- Aktif provider adını env'den oku (sender.ts'teki `channelName` ile aynı mantık).
- Sabit test mesajı ile `sendSMSDirect`/`sendWhatsAppDirect`/`sendEmailDirect` çağır.
  E-posta: konu "BakımX Test E-postası", basit HTML gövde.
- Provider constructor kredansiyel eksikse fırlatır (Türkçe mesaj) → `try/catch` ile
  yakala, `{ success:false, provider, error }` döndür.
- `communicationLog`'a kayıt: `templateKey:"test"`, `entityType:"test"`,
  `status: sent|failed`.
- Döner: `{ success, provider, providerId?, error? }`.

### 2. `src/app/api/communications/test/route.ts` (POST)

Mevcut `templates/route.ts` desenini izler: `requireAuth()` → `formData` →
`sendProviderTestAction` → `NextResponse.json`. Auth hatası 401.

### 3. UI — `components/app/notification-settings.tsx`

- `PROVIDER_LABELS`'a `gmail: "Gmail"` ekle (bug fix).
- "Aktif Sağlayıcılar" panelinde her kanal kartına: alıcı input'u + "Test gönder"
  butonu + satır-içi sonuç. Sonuç **kullanılan provider'ı** yazar; provider `mock`
  ise "test modu — gerçek gönderim yapılmadı" uyarısı. Mobile-first.

## Canlıya alma (operasyonel, kod değil)

`.env` + **sunucu restart** (provider singleton cache'li):
- Gmail: `EMAIL_PROVIDER=gmail`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`
- Netgsm: `SMS_PROVIDER=netgsm`, `NETGSM_USERCODE`, `NETGSM_PASSWORD`, `NETGSM_SENDER`
- WhatsApp: `WHATSAPP_PROVIDER=business`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`

## Riskler

- Env değişince restart şart (singleton).
- Gerçek modda test, gerçek kredi/kota tüketir → rate-limit + açık buton ile sınırlı.
- Mock modda test "başarılı" döner ama gerçek gönderim yok → UI net belirtir.

## Dokunulan dosyalar

- `src/app/(app)/settings/notifications/actions.ts` (+aksiyon)
- `src/app/api/communications/test/route.ts` (yeni)
- `src/components/app/notification-settings.tsx`

## Manuel QA

1. Mock modda her kanala test → "test modu, gerçek gönderim yok" sonucu.
2. Geçersiz telefon/e-posta → doğrulama hatası.
3. 6 hızlı test → rate-limit hatası.
4. Gerçek kredansiyel + restart → gerçek gönderim, sonuçta provider adı.
5. Kredansiyel eksik gerçek provider → constructor hatası düzgün gösteriliyor.
