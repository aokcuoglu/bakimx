# BakımX — Yayınlanmamış (v0.5.16 sonrası)

**Durum:** Tag'lenmemiş — `main` üzerinde birikmiş geliştirmeler.
**Önerilen sürüm:** **v0.6.0** (kapsam yama değil, özellik sürümü seviyesinde: ~172 dosya, +10.892 / −1.595).
**Migration:** Evet — `add_cron_run`, `add_feature_override_and_impersonation`, `vehicle_catalog`.

## Overview
v0.5.16'dan bu yana birden çok feature dalı `dev` üzerinden birleşti. Operasyonel akış (kabul→teslim), kanıt/dokümantasyon, katalog, admin yetenekleri ve transactional e-posta tarafında önemli ilerleme var. Tek bir özellik sürümü olarak tag'lenmesi önerilir.

## Yeni — Operasyon & teslim
- **Teslim OTP devri (Faz D):** "delivered" durumu OTP arkasına alındı (manuel geçiş engellendi); OTP iste/doğrula API + server action'ları; tam 6 hane zorunlu; SMS gönderim hatası tespiti; `isOtpExpired` yardımcı.
- **Birleşik iş emri akışı (Faz A/B):** sihirbaz 3 adıma indirildi, "Araç Kabulleri" menüden çıkarıldı; seçici geri-hidrasyon; km ön-doldurma/koruma.
- İş emri detaylarını düzenleme (şikâyet/not/km) + denetim (audit) zaman çizelgesi.
- İç etiket: "Araç Kabulü" → "İş Emri" (pazarlama/müşteri-yüzü korunarak).

## Yeni — Kanıt & dokümantasyon (Faz C)
- **PhotoAnnotate:** kamera ile çekim + görsel üzerine kalemle işaretleme; intake sihirbazı foto adımına ve detay ekranına bağlandı (SVG hasar haritasının yerine).
- Görsel küçültme yardımcı (`fitDimensions`).
- İş emri 1. adımda **kamera ile plaka OCR**; Tesseract traineddata imaja gömüldü (staging/prod'da çalışsın); plaka tarama hızlandırması + diagnostik.

## Yeni — Katalog
- **DB tabanlı araç marka/model/tip kataloğu:** Prisma modelleri + migration, bağımlı combobox'lar (marka→model), arama API'leri, import scripti + gzip seed.
- Intake modalı ve araç formunda DB-tabanlı marka/model seçici.

## Yeni — Admin
- **Impersonation** + **işletme bazlı feature flag** (Faz 2).
- Back-office ops paneli: routed console + audit/health + RBAC seam (Faz 1).
- `add_cron_run` ve `add_feature_override_and_impersonation` migration'ları.

## Yeni — İletişim & sistem
- **Transactional onay e-postaları:** Gmail SMTP sağlayıcı (timeout korumalı), 4 sistem e-posta şablonu (başvuru alındı / admin bildirimi / onay / red), markalı e-posta düzeni, en-iyi-çaba `sendSystemEmail` sarmalayıcı + loglama.
- İletişim sağlayıcı test-gönderimi.

## Yeni — Diğer
- Release tooling: `npm run release` sürüm-damgalama; `main`'e push'ta prod tetikleme.
- Premium oto-temalı global 404 sayfası.
- Mimari: modül + altyapı diyagramları.
- Auth panellerinde stok foto yerine marka navy gradyan.

## Tag öncesi kontrol listesi
- [ ] `bun run lint` / `typecheck` / `build` yeşil
- [ ] `bunx prisma validate` + 3 yeni migration staging'de uygulandı
- [ ] Teslim OTP akışı uçtan uca (iste→SMS→doğrula→delivered)
- [ ] PhotoAnnotate mobilde çekim + işaretleme + kaydetme
- [ ] Marka/model seçici arama + doğrulama
- [ ] Admin impersonation ve feature flag güvenli (yalnızca yetkili)
- [ ] Plaka OCR staging'de timeout'suz çalışıyor
- [ ] `package.json` → 0.6.0, bu dosya `v0.6.0.md` olarak yeniden adlandırıldı
