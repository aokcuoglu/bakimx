# BakımX Site Asistanı — Tasarım Dokümanı

**Tarih:** 2026-07-09
**Durum:** Onaylandı (implementation planına hazır)
**Branch (önerilen):** `feat/site-assistant`

## 1. Amaç

Landing/pazarlama sayfalarında, Tekmetric'teki "Gauge" örneğine benzer bir **satış/lead yakalama** widget'ı. Ziyaretçiyi karşılar, hızlı aksiyonlar sunar ve mevcut lead altyapısına (demo/destek talepleri) besler. **Gerçek AI değildir** — buton/form tabanlı yönlendirmedir (Tekmetric'in Gauge'i de öyle).

Karar özeti (brainstorm):
- Asıl amaç: **satış/lead yakalama**
- Yaklaşım: **kendi widget'ımız** (3rd party değil) — tam kontrol, veri bizde, aylık ücret yok, KVKK bizde
- Persona: **isimsiz**, "BakımX Asistanı"
- Kapsam: **tüm public/pazarlama sayfaları**; uygulama içi ve admin'de görünmez

## 2. Kapsam (scope)

### Dahil
- Sağ-altta sabit launcher (FAB) + açılır panel
- 4 hızlı aksiyon: Demo talep et · Satın al/Fiyatlar · Destek/İletişim · Sık Sorulanlar
- Demo ve Destek için panel-içi mini formlar → **mevcut** API'lere POST
- SSS görünümü (mevcut FAQ içeriğinden)
- Sadece public sayfalarda görünürlük

### Dahil değil (YAGNI)
- Gerçek AI/LLM sohbet (serbest metin cevaplama) — YOK
- Canlı insan desteği / real-time chat — YOK
- Yeni DB modeli / migration — YOK
- Yeni API endpoint — YOK
- Otomatik "merhaba" açılış balonu — varsayılan KAPALI (yapı ekmeye uygun bırakılır, ama bu sürümde yok)
- Uygulama içi (login sonrası) veya admin görünürlüğü — YOK

## 3. Mimari

### Mount noktası
- `(app)` ve `(auth)` route grupları kendi layout'larına sahiptir; public sayfalar (`/`, `/fiyatlar`, `/demo`, `/satin-al`, `/terms`, `/privacy`) kök `src/app/layout.tsx`'i kullanır.
- Widget kök layout'a **tek satırla** eklenir: `<SiteAssistant />` (Toaster yanına).
- `SiteAssistant` bir client component'tir; içeride `usePathname()` ile **public allowlist** kontrolü yapar. Allowlist dışındaki her yolda `return null` — yani `(app)`, `(auth)`, `/admin`, `/checkout`, `/payment`, `/p`, `/s`, `/invite` gibi yollarda hiç render olmaz.

**Allowlist (public path'ler):**
```
/            (tam eşleşme)
/fiyatlar
/demo
/satin-al
/terms
/privacy
```
Eşleşme kuralı: `pathname === "/"` veya `pathname` bu prefix'lerden biriyle başlıyorsa göster. (Alt yollar oluşursa kapsar; şu an hepsi tek seviyeli.)

### Backend (yeni yok)
Mevcut endpoint'lere bağlanır:
- `POST /api/demo-request` — alanlar: `name, businessName, phone, city, monthlyVehicles, notes?`. Rate-limit'li (IP başına 60sn'de 3), sunucu-tarafı valide, `DemoRequest` tablosuna yazar, admin "Demo Talepleri"nde görünür.
- `POST /api/support-request` — alanlar: `name, businessName, email, phone, subject, message`. Aynı rate-limit/validasyon deseni, `SupportRequest` tablosuna yazar, admin "Destek Talepleri"nde görünür.

Her iki endpoint yanıtı: `{ success: boolean, errors?: Record<string,string>, message?: string }`. Widget bu sözleşmeyi kullanır; alan-bazlı `errors` mini formda ilgili alanın altında gösterilir, `_general` genel hata olarak gösterilir.

## 4. Bileşen yapısı

Yeni klasör: `src/components/site-assistant/`

- `site-assistant.tsx` — üst bileşen (`"use client"`): pathname gate, açık/kapalı state, launcher + panel render, görünüm (view) yönlendirmesi.
- `assistant-launcher.tsx` — FAB (sağ-alt sabit, marka mavisi, `MessageCircle` ikonu, kapat durumunda ikon değişir).
- `assistant-panel.tsx` — panel kabı (başlık + kapat + gövde). Görünüm state'ine göre alt görünümü render eder.
- `views/menu-view.tsx` — karşılama + 4 aksiyon butonu.
- `views/demo-form-view.tsx` — demo mini formu.
- `views/support-form-view.tsx` — destek mini formu.
- `views/faq-view.tsx` — SSS listesi (accordion).
- `views/success-view.tsx` — teşekkür + menüye dön.

Ortak veri:
- `src/lib/faq-data.ts` — `FAQSection.tsx` içindeki `faqs` dizisi buraya taşınır ve export edilir. Hem `FAQSection` hem `faq-view` bu tek kaynağı import eder (kod tekrarı yok).

### View state modeli
`site-assistant.tsx` içinde:
```ts
type AssistantView = "menu" | "demo" | "support" | "faq" | "success";
```
- `open: boolean` — panel açık mı
- `view: AssistantView` — aktif görünüm
- `successContext: "demo" | "support" | null` — success mesajını bağlamlandırmak için

Geçişler:
- menu → (Demo) → demo → (submit ok) → success(demo)
- menu → (Destek) → support → (submit ok) → success(support)
- menu → (SSS) → faq → (geri) → menu
- menu → (Satın al) → `window.location`/`<a>` ile `/satin-al` (panel içinden yönlendirme; yeni sekme değil)
- success → (yeni istek / kapat) → menu veya kapan
- Her alt görünümde "← Geri" ile menu'ye dönüş

## 5. UI / stil kuralları

- **Tüm etkileşimli kontroller shadcn `ui/*` primitifleri:** `Button`, `Input`, `Textarea`. (Şehir/aylık araç gibi seçimler için mevcut `ui/select` veya basit `ui/input` — plan aşamasında netleşir; landing demo formundaki mevcut deseni takip et.) Panel kabı yalnızca konumlandırma/`div` — özel "UI kontrolü" değil.
- **h-9 kuralı:** tüm form kontrolleri web'de `h-9`. Birincil CTA `size` ile.
- **Renk:** blue/navy marka dili; FAB ve başlık marka mavisi (`#2563EB` / `bg-primary`). WhatsApp yeşili yalnızca ilgili yerde.
- **Mobile-first:** masaüstünde ~`sm:w-[380px]` yüzen kart; mobilde alttan neredeyse tam genişlik (`w-[calc(100vw-2rem)]` benzeri, kenar boşluklu). FAB güvenli alan/`env(safe-area-inset)` gözetir.
- **z-index:** Toaster/dialog'ların altında kalmayacak, ama modal-üstü olmayacak bir katman (ör. `z-40`).
- **Erişilebilirlik:** panel açıkken focus yönetimi, `Esc` ile kapat, FAB'da `aria-label`, formlarda label/`aria-invalid`.
- **BrandSpinner** submit sırasında (skeleton değil — proje kuralı).

## 6. Davranış detayları

- **Açık/kapalı kalıcılığı:** `localStorage` anahtarı (ör. `bakimx.assistant.dismissed`). Kullanıcı kapatınca oturumlar arası kapalı kalır; tekrar FAB'a basınca açılır. İlk ziyarette **kapalı** başlar.
- **Client validasyon** + sunucu validasyonu birlikte. Sunucu `errors` döndürürse alan altına yaz.
- **Rate-limit (429):** `_general` mesajını göster ("Çok fazla istek, biraz bekleyin").
- **Ağ hatası:** genel hata mesajı + tekrar dene.
- **Reset:** panel kapanıp açılınca form state temizlenir (yarım kalan giriş taşınmaz), view `menu`'ye döner (success'ten sonra kapatıldıysa).

## 7. Dokunulan dosyalar

**Yeni:**
- `src/components/site-assistant/site-assistant.tsx`
- `src/components/site-assistant/assistant-launcher.tsx`
- `src/components/site-assistant/assistant-panel.tsx`
- `src/components/site-assistant/views/menu-view.tsx`
- `src/components/site-assistant/views/demo-form-view.tsx`
- `src/components/site-assistant/views/support-form-view.tsx`
- `src/components/site-assistant/views/faq-view.tsx`
- `src/components/site-assistant/views/success-view.tsx`
- `src/lib/faq-data.ts`

**Değiştirilen:**
- `src/app/layout.tsx` — `<SiteAssistant />` mount (1 satır + import)
- `src/components/sections/FAQSection.tsx` — `faqs` dizisini `@/lib/faq-data`'dan import et (davranış aynı kalır)

**Değişmeyen:** Prisma şeması, migration'lar, API route'ları, admin panelleri.

## 8. Risk analizi

- **Migration riski:** YOK (şema dokunulmuyor).
- **Ana risk:** pathname-gate'in `(app)`/`(auth)`/`admin` ve satın alma sonrası alanları doğru dışlaması. Manuel QA ile doğrulanır.
- **Tenant izolasyonu:** Widget kimlik-öncesi (public) çalışır, tenant verisine erişmez; sadece public POST endpoint'lerine yazar. Server tarafı zaten valide + rate-limit'li.
- **Layout-shift / performance:** client component ama küçük; kök layout'a eklenince tüm sayfalarda hidrasyon olur fakat gate erken `null` döner (public dışı sayfalarda ağır iş yok).
- **FAQSection refactor:** yalnızca veri kaynağı taşınıyor; görsel/davranış birebir korunur.

## 9. Manuel QA adımları

1. `/` (landing): FAB görünür, açılır, karşılama + 4 buton doğru.
2. Demo formu: geçersiz alanla submit → alan hataları; geçerli submit → success; admin "Demo Talepleri"nde yeni kayıt.
3. Destek formu: aynı akış → admin "Destek Talepleri"nde kayıt.
4. Satın al butonu → `/satin-al`'a gider.
5. SSS: sorular açılır/kapanır, içerik FAQSection ile birebir.
6. `/fiyatlar`, `/demo`, `/satin-al`, `/terms`, `/privacy`: FAB görünür.
7. Login → `(app)` dashboard, `/admin`, `/checkout`: FAB **görünmez**.
8. Mobil (dar viewport): panel taşmıyor, tam genişlik, kapat çalışıyor, safe-area uygun.
9. Kapat → sayfa yenile → kapalı kalıyor; FAB'a bas → açılıyor.
10. Klavye: Esc kapatır, focus yönetimi çalışır.
11. Rate-limit: 60sn'de 4. submit → `_general` uyarısı.

## 10. Test / doğrulama

- `bun install` (gerekirse), lint, typecheck.
- Yerel dev'de yukarıdaki manuel QA (Playwright ile landing + gate doğrulaması yapılabilir).
- Yeni bağımlılık eklenmez (mevcut framer-motion, lucide, shadcn/ui yeterli).
