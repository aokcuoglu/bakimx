# BakımX — Mimari Analiz ve Teknik Değerlendirme Raporu

**Ürün:** Otomotiv yetkisiz servisleri için mobil öncelikli operasyon yönetim platformu (SaaS)
**Depo:** `aokcuoglu/bakimx` · **İncelenen sürüm:** v0.5.9 (HEAD)
**Hazırlayan:** Kıdemli Yazılım Mimarı / Teknik Analist · **Tarih:** 2026-06-22

> Bu rapor hem teknik ekibe hem de teknik olmayan paydaşlara (yatırımcı, ürün sahibi, yönetim)
> hitap edecek şekilde yazılmıştır. Teknik terimler ilk geçtikleri yerde kısaca açıklanmıştır.

---

## 1. Genel Mimari Analiz

### 1.1. Teknoloji Stack'i (kullanılan teknolojiler)

| Katman | Teknoloji | Ne işe yarar (sade açıklama) |
|--------|-----------|------------------------------|
| Dil | **TypeScript** (strict mod) | JavaScript'in tip güvenli, hata yakalayan sürümü |
| Framework | **Next.js 16** (App Router) | Hem web sayfalarını hem sunucu kodunu tek çatıda üreten modern web çatısı |
| Arayüz | **React 19** | Ekran bileşenlerini oluşturan kütüphane |
| Tasarım | **Tailwind CSS 4 + shadcn / Base UI + framer-motion** | Hızlı, tutarlı ve animasyonlu mobil öncelikli arayüz |
| Veritabanı | **PostgreSQL** | Tüm verinin tutulduğu ilişkisel veritabanı |
| ORM | **Prisma 7** (pg adapter) | Veritabanı tablolarını kod tarafında güvenle yönetmeyi sağlayan katman |
| Oturum/Güvenlik | **iron-session + bcryptjs** | Şifreli oturum çerezi ve parola hash'leme (parolaları düz metin saklamama) |
| Doğrulama | **Zod + react-hook-form** | Kullanıcı girdilerini sunucuda ve formda kurallara göre denetleme |
| Dosya depolama | **AWS S3 SDK → Cloudflare R2** | Fotoğrafların bulut depoda saklanması (S3 uyumlu) |
| OCR | **tesseract.js** (+ OpenAI/DeepSeek opsiyonel) | Ruhsat fotoğrafından metin okuma |
| PDF | **@react-pdf/renderer** | Müşteriye sunulan çıktıların PDF/yazdırma hâli |
| Diğer | **nanoid, qrcode.react, heic-convert** | Güvenli token üretimi, QR kod, iPhone HEIC fotoğraf dönüşümü |
| Paket yöneticisi | **Bun** (Node 18+ uyumlu) | Bağımlılık kurulumu ve script çalıştırma |

### 1.2. Proje Yapısı ve Klasör Organizasyonu

```
bakimx/
├── src/app/            → Tüm sayfalar ve API uçları (Next.js App Router)
│   ├── (auth)/         → Giriş, şifremi unuttum, register (kapatılmış)
│   ├── app/            → Korumalı operasyon paneli (asıl ürün)
│   ├── api/            → 47 adet sunucu API ucu (REST tarzı)
│   ├── s/[token]/      → Müşteriye açık servis özeti (tokenlı, public)
│   └── p/[token]/      → Araç servis pasaportu (tokenlı, public)
├── src/components/     → Arayüz bileşenleri (ui/ + uygulamaya özel)
├── src/lib/            → İş mantığı: auth, money, storage, ocr, advisor,
│                          communications, calendar, reports, validations…
├── prisma/             → Veritabanı şeması (33 model), migration, seed
├── scripts/            → VPS kurulum, OCR yardımcıları
├── docs/               → Sürüm notları, QA listeleri, dağıtım kılavuzu
└── docker-compose*.yml → Yalnızca production/yerel altyapı (PostgreSQL+MinIO)
```

**Öne çıkan organizasyon kararları:**
- **İş mantığı `src/lib/` altında modüllere ayrılmış** (storage, ocr, advisor, communications, calendar). Her biri "provider abstraction" (sağlayıcı soyutlaması) deseni kullanır — yani gerçek servis (ör. NetGSM SMS) ile sahte/test servisi (mock) aynı arayüzün arkasındadır ve `.env` değişkeniyle değiştirilebilir.
- **Doğrulama kuralları tek yerde** (`src/lib/validations/`, Zod şemaları, Türkçe hata mesajları).
- **Çok kiracılı (multi-tenant) izolasyon**: her sorgu `workshopId` (işyeri kimliği) ile sınırlanır — bir servisin verisi diğerine sızmaz.

### 1.3. Mimari Yaklaşım

- **Tip:** **Monolit** (tek parça uygulama) — tüm modüller tek Next.js uygulaması içinde. Mikroservis yok; bu ölçek için doğru ve sade bir tercih.
- **Çalışma modeli:** **Full-stack / sunucu öncelikli**. Sunucu bileşenleri (server components) ve sunucu aksiyonları (server actions, doğrudan formdan sunucu fonksiyonu çağırma) ağırlıkta; ek olarak 47 REST API ucu var.
- **Veri akışı:** Sayfa/Form → Server Action veya API Route → Zod doğrulama → Prisma → PostgreSQL; çıktı PDF/WhatsApp/public token sayfası.
- **Kimlik & yetki:** `middleware.ts` korumalı yolları kontrol eder; oturum şifreli çerezde (iron-session) tutulur.
- **Dağıtım:** Yerelde Docker **kullanılmaz** (ürün kuralı), yalnızca production/VPS için Docker + GitHub Actions (GHCR imaj + SSH deploy) + Cloudflare R2 depolama.

---

## 2. Tamamlanmış Özellikler (Feature List)

> Durum etiketleri: ✅ **Tamamlanmış** · 🟡 **Çalışır ama gerçek entegrasyon doğrulanmamış** · 🔵 **Temel/iskelet**

### Çekirdek Operasyon

| Özellik | Ne yapar | Modül / Dosya | Durum |
|---------|----------|---------------|-------|
| Kimlik doğrulama & oturum | Güvenli giriş, oturum, çıkış; **public kayıt kapalı** | `(auth)/login`, `lib/auth.ts`, `lib/auth-login.ts` | ✅ |
| İşyeri profili | Servis bilgileri, marka/logo ayarı | `app/workshop`, `api/workshop` | ✅ |
| Müşteri yönetimi | Bireysel/kurumsal, etiket, KVKK onayı, bakiye | `app/customers`, `lib/validations/customer.ts` | ✅ |
| Araç yönetimi | Plaka, marka, model, VIN, km kaydı ve arama | `app/vehicles`, `api/vehicles` | ✅ |
| Araç kabul (intake) | Adımlı kabul sihirbazı | `app/intakes`, `intakes/actions.ts` | ✅ |
| Fotoğraf kontrol listesi | Zorunlu/opsiyonel fotoğraf yakalama | `intakes`, `api/intakes/photos` | ✅ |
| 2D hasar işaretleme | Araç şeması üzerinde hasar konumu/şiddeti | intake bileşenleri, `DamageMark` modeli | ✅ |
| Müşteri onayı (OTP) | SMS kodu ile dijital onay (varsayılan demo modu) | `verify-otp`, `status-transitions.ts` | 🟡 |
| İş emri (work order) | Tam yaşam döngüsü, parça/işçilik, ödeme durumu, iskonto/vergi | `app/orders`, `orders/actions.ts` | ✅ |
| Public servis özeti | Tokenlı müşteri sayfası + PDF/WhatsApp paylaşımı | `s/[token]`, `lib/share/whatsapp.ts` | ✅ |

### İş Geliştirme Modülleri

| Özellik | Ne yapar | Modül / Dosya | Durum |
|---------|----------|---------------|-------|
| Operasyon paneli | KPI, uyarılar, sıfır bağımlılıklı grafikler | `app/page.tsx`, `lib/dashboard/queries.ts` | ✅ |
| Teklifler | Teklif oluşturma → iş emrine dönüştürme | `app/quotes`, `validations/quote.ts` | ✅ |
| Randevular | Randevu planlama → iş emrine dönüştürme | `app/appointments`, `appointments/actions.ts` | ✅ |
| Parça & stok | Katalog, kritik stok eşiği, stok hareketi | `app/parts`, `lib/parts/` | ✅ |
| Tedarikçiler | Tedarikçi kayıtları, parça bağlantısı | `app/suppliers`, `lib/suppliers/` | ✅ |
| Kasa & tahsilat | Manuel/kısmi ödeme, iptal, yaşlandırma raporu | `app/cashbox`, `lib/cashbox/` | ✅ |
| Bakım hatırlatmaları | Periyodik bakım kaydı + kanal tercihi | `app/reminders`, `lib/reminders/` | 🟡 (gerçek gönderim garanti değil) |
| Raporlama | İş emri, müşteri, tahsilat, parça, teknisyen raporları | `app/reports/*`, `lib/reports/` | ✅ |
| Operasyonel analitik | Kural tabanlı içgörüler (LLM'siz) | `app/analytics`, `lib/analytics/` | ✅ |
| İşyeri ayarları | 7 sekmeli yapılandırma + markalama | `app/settings`, `validations/settings.ts` | ✅ |

### Akıllı & Entegrasyon Modülleri

| Özellik | Ne yapar | Modül / Dosya | Durum |
|---------|----------|---------------|-------|
| OCR akıllı yakalama | Ruhsat fotoğrafından müşteri/araç oluşturma | `app/smart-capture`, `lib/ocr/` | 🟡 (gerçek OCR doğrulanmamış) |
| AI servis danışmanı | Şikâyetten öneri (onay zorunlu, otomatik eklemez) | `api/advisor`, `lib/advisor/` | 🟡 |
| Dijital araç pasaportu | Aracın tüm servis geçmişi + QR + public özet | `vehicles/[id]/passport`, `lib/passport/` | ✅ |
| Teknisyen mobil çalışma alanı | Teknisyene iş emri, parça talebi, işçilik kaydı | `app/technician`, `lib/technician/` | 🟡 (en yeni, en az test edilmiş) |
| İletişim altyapısı | SMS/WhatsApp/E-posta sağlayıcı soyutlaması | `lib/communications/` (NetGSM, Resend, WhatsApp Business) | 🟡 (varsayılan mock) |
| Takvim & otomasyon | Google Calendar sağlayıcısı + hatırlatma zamanlayıcı | `lib/calendar/` | 🟡 |
| Depolama (S3/R2) | Fotoğrafların kalıcı, kiracıya özel saklanması | `lib/storage/` | ✅ (mock varsayılan) |

**Özet sayılar:** 33 veritabanı modeli · 47 API ucu · 19 server-action dosyası · 6 sağlayıcı soyutlaması · 30+ sürüm (v0.0.1 → v0.5.9).

---

## 3. Kod Kalitesi ve Teknik Değerlendirme

### 3.1. Olgunluk Seviyesi

**Seviye: "Geç MVP / Pilot üretime hazır beta" (1.0 öncesi, sertleştirilmiş).**

Bu, basit bir prototipin çok ötesinde, ancak tam ölçekli üretime geçişten bir adım önce olan bir üründür.

**Olgunluğu destekleyen güçlü göstergeler:**
- ✅ TypeScript **strict** mod — tip güvenliği yüksek, `any` kullanımı sınırlı (proje kuralı).
- ✅ **Tutarlı sağlayıcı soyutlaması** (storage/ocr/advisor/communications/calendar) — gerçek servisleri risksiz takıp çıkarmaya uygun, profesyonel bir desen.
- ✅ **Sunucu tarafı doğrulama** her yerde Zod ile yapılıyor.
- ✅ **Çok kiracılı izolasyon** disiplinli: `workshopId` oturumdan türetiliyor (v0.5.8'de istemciye güven kaldırıldı).
- ✅ **Güvenlik P0 (kritik) açıkları kapatılmış** (v0.5.7–v0.5.8) ve **veri bütünlüğü** sağlanmış (v0.5.9 ile `$transaction` ve para tutarlılığı).
- ✅ Üretim **dağıtım hattı** hazır (Docker + GitHub Actions + VPS provisyon + tek migration baseline).
- ✅ Düzenli **sürüm notları ve QA kontrol listeleri** (`docs/`) — disiplinli mühendislik kültürü.

### 3.2. Eksik veya Yarım Kalmış Bileşenler

- 🟡 **Gerçek entegrasyonlar doğrulanmamış:** İletişim (SMS/WhatsApp/E-posta), OCR ve AI danışmanı kod olarak hazır ama **varsayılanları "mock" (sahte)**; production'da uçtan uca kanıtlanmış değil.
- 🟡 **Bakım hatırlatmalarının gerçek gönderimi** garanti altında değil (kayıt tutuluyor, otomatik dağıtım tamamlanmamış).
- 🟡 **Takvim senkronizasyonu** Google OAuth ile çift yönlü çalışacak seviyede değil (iskelet mevcut).
- 🔵 **"Yakında" etiketli vaatler:** Excel içe aktarma ve sesle doldurma landing/arayüzde stub (içi boş) durumda.
- 🟠 **Otomatik test kapsamı çok ince:** Yalnızca 3 birim test dosyası var (`money`, `totals`, `cashbox/status`). Entegrasyon/uçtan uca (E2E) test yok — regresyon (yeni değişikliğin eskiyi bozması) riski yüksek.

### 3.3. Potansiyel Teknik Borç Alanları

| Alan | Açıklama | Risk |
|------|----------|------|
| Para alanları `Float` saklanıyor | Ondalık hassasiyet `Decimal` yerine kayan noktalı; v0.5.9'da epsilon (tolerans) ile hafifletildi ama kök çözüm değil | **Orta** — ölçekte yuvarlama kayması |
| Bellek-içi hız sınırlama (rate-limit) | Süreç başına; birden çok sunucu kopyası çalışınca paylaşılmıyor | **Yüksek** — yatay ölçeklemeyi engeller |
| OTP sertleştirme eksik | Kod entropisi/süre/deneme limiti hâlâ açık (v0.5.7'de ertelendi) | **Orta** — onay akışı suistimali |
| `db.ts` placeholder bağlantı | Veritabanı yapılandırılmamışsa sahte bağlantıya düşüyor — hatalı yapılandırmayı gizleyebilir | **Düşük** |
| `middleware.ts` eski sözleşme | Next.js 16, `proxy` sözleşmesini öneriyor; mevcut çalışıyor ama deprecated | **Düşük** |
| İnce test kapsamı | Otomatik güvence az | **Yüksek** |
| Eksik ürün modülleri | e-Fatura, abonelik/faturalama, çoklu şube yok | Ürün kapsamı |

---

## 4. Sonuç ve Özet

### 4.1. Ürünün Mevcut Yetenekleri (tek paragraf)

BakımX, oto servislerin günlük operasyonunu uçtan uca yönetebilecek olgunlukta, mobil öncelikli bir SaaS platformudur: işyeri müşteri ve aracını kaydeder, fotoğraflı ve 2D hasar işaretlemeli dijital araç kabulü yapar, müşteriden OTP ile dijital onay alır, parça/işçilik kalemleriyle iş emri yürütür, kasa-tahsilat ve teklif/randevu süreçlerini takip eder, parça-stok ve tedarikçi yönetir, raporlama ve kural tabanlı analitik sunar, ve müşteriye tokenlı public servis özeti ile araç servis pasaportunu PDF/WhatsApp üzerinden paylaşır. Tüm bunlar çok kiracılı (her servisin verisi izole) bir yapıda, sunucu tarafı doğrulama ve kapatılmış kritik güvenlik açıklarıyla, üretime dağıtılabilir bir altyapı üzerinde çalışmaktadır; SMS/WhatsApp, OCR ve AI gibi "akıllı" yetenekler ise mimari olarak hazırdır ancak henüz çoğunlukla demo (mock) modunda olup gerçek üretim entegrasyonu doğrulanmayı beklemektedir.

### 4.2. Öne Çıkan Güçlü Yönler

- 🟢 **Geniş ve gerçekçi özellik kapsamı** — sektörün çekirdek operasyonunu fiilen karşılıyor.
- 🟢 **Temiz, soyutlanmış mimari** — sağlayıcı desenleri sayesinde gerçek servisleri takmak düşük riskli.
- 🟢 **Güvenlik ve veri bütünlüğüne yatırım** — tenant izolasyonu, XSS kapatma, transaction'lar, denetim günlüğü (audit log).
- 🟢 **Disiplinli mühendislik kültürü** — strict TypeScript, sürüm notları, QA kontrol listeleri, tek migration baseline.
- 🟢 **Doğru ölçek tercihi** — gereksiz karmaşıklık yok; bu aşama için monolit isabetli.

### 4.3. Geliştirme Önceliği Önerilen Alanlar

1. **Dağıtık dayanıklılık (en yüksek öncelik):** Hız sınırlama ve OTP saklamayı Redis/DB tabanlı paylaşımlı yapıya taşı; bu hem en kritik açık güvenlik borcunu kapatır hem de yatay ölçeklemeyi açar.
2. **Gerçek iletişim entegrasyonunu canlıya alma:** SMS/WhatsApp/E-posta'yı production'da doğrula, teslim günlüğü, yeniden deneme ve KVKK/opt-out kurallarıyla — "Yakında" denen en görünür vaadi aktive eder.
3. **Test & CI sertleştirme:** intake → onay → iş emri → tahsilat akışı için E2E testler ve CI kapsam eşiği — regresyon riskini ciddi düşürür.
4. **Para modeli düzeltmesi:** Faturalama eklemeden önce parayı `Decimal`/tam sayı (kuruş) tabanına geçir.
5. **OCR/AI üretim doğrulaması:** Gerçek sağlayıcılarda doğruluk ve maliyet ölçümü, güvenli geri-düşüş (fallback) zinciri.

> **Tek cümlelik tavsiye:** Ürün ticari pilota çok yakın; bir sonraki adım yeni özellik eklemek değil, **mevcut "temelleri" gerçek, ölçeklenebilir ve test edilmiş üretim yeteneğine dönüştürmek** olmalı — `v0.6.0` olarak dağıtık dayanıklılık + OTP sertleştirmesiyle başlamak en yüksek getiriyi sağlar.

---

*Bu rapor, deponun tam kaynak kodu ve git geçmişi incelenerek 2026-06-22 tarihinde hazırlanmıştır.*
