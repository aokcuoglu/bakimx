# Tasarım: ülkeye göre stillenen tek `Plate` bileşeni (#818)

Onay: 2026-11-24, alpkaan. Boyut: küçük — tek PR.

## Amaç ve neden

Plaka rozeti bugün iki ayrı bileşenle çiziliyor — `PlateBadge`
(`src/components/shared/plate-badge.tsx`, "TR" yazılı mono rozet, ~16 çağrı
yeri) ve `DashPlate` (`src/components/dashboard/surface.tsx`, çerçeveli,
yazısız mavi bant; 7 çağrı yeri) — ve ikisi de her plakayı Türk plakası sayıyor.
Atölyelere seyrek de olsa gurbetçi araçları geliyor. Tek bir `Plate` olsun, rozet
olarak plaka gösteren her yer onu kullansın, ve yabancı plaka kendi ülkesinin
plakası gibi görünsün.

## Hedefler

- `src/components/shared/plate.tsx` → `<Plate plate="…" size="sm|md|lg" />`.
  Ülkeyi çağıran vermez, bileşen tahmin eder. Sunucu bileşeninde çalışır
  (`"use client"` yok).
- Ülke tanıma saf fonksiyon: `src/lib/plate/country.ts`, tablo testleriyle.
- `PlateBadge`, `DashPlate`, `formatTurkishPlate` kaldırılır; tüm çağrı yerleri
  `Plate` kullanır.

## Hedef dışı

- Şema değişmez, araca ülke alanı eklenmez (kullanıcı kararı: varsayılan TR +
  tahmin).
- Plaka OCR'ı, arama (`uppercaseIfPlateLike`) ve doğrulama TR varsayımıyla kalır.
- Cümle içinde, başlıkta, breadcrumb'da ve rapor tablosunda düz metin geçen
  plakalar metin kalır.

## Anti-hedef

Yanlış yazılmış bir TR plakasının yabancı ülke rozetiyle görünmesi. Bu yüzden TR
kuralı ilk ve geniş: il kodu 01–81 ile başlayıp harf + rakam süren her plaka TR'dir.

## Kısıt

Plakalar `normalizePlate` ile sıkıştırılmış saklanır (`"MAB1234"`): boşluk ve
tire kayıp. Ülke yalnız harf/rakam dizilişinden çıkarılır; bazı ülkeler aynı
dizilişi paylaşır (Fransa = İtalya; Avusturya, Bulgaristan ve Fransa ile çakışır).

## Yaklaşımlar

- **A — yalnız TR / yabancı ayrımı.** Uymayan plaka ülkesiz çizilir. Yanlış ülke
  riski sıfır ama ülke görünmez.
- **B — TR + ayırt edilebilen birkaç ülke (SEÇİLDİ).** Gurbetçilerin yoğun geldiği
  ve dizilişinden güvenle tanınan ülkeler; çakışan/tanınmayan her şey TR'ye düşer.
- (Araca ülke alanı eklemek elendi: kullanıcı şema değişikliği istemedi, sıklık
  düşük.)

## Tanıma sırası (ilk eşleşen kazanır)

| Ülke | Sıkıştırılmış desen | Gösterim |
|---|---|---|
| TR | `(0[1-9]\|[1-7]\d\|8[01])` + 1–3 harf + rakam | `34 MHP 923` |
| Belçika (B) | rakam + 3 harf + 3 rakam | `1-ABC-123`, kırmızı yazı |
| Bulgaristan (BG) | BG il kodu + 4 rakam + 2 harf | `CA 1234 AB` |
| İngiltere (UK) | 2 harf + 2 rakam + 3 harf | `AB12 CDE` |
| Hollanda (NL) | 6 karakterlik sidecode desenleri (tümü harf→rakam olan 1 ve 5 hariç) | `12-ABC-3`, sarı zemin |
| Almanya (D) | 2–5 harf + 1–4 rakam (+ `E`/`H`) | `MAB 1234` |
| hiçbiri | — | TR bandı, metin olduğu gibi |

Almanya'da boşluk yalnız harf/rakam sınırına konur — şehir kodunun nerede
bittiği saklanan metinden çıkarılamaz.

## Görünüm

- TR: bugünkü `DashPlate` görünümü birebir (çerçeve, yazısız mavi bant).
  `PlateBadge` ekranları da bu görünüme geçer — bilinçli birleştirme.
- Yabancı: bant genişler ve ülke kodunu yazar; ekran okuyucu ülke adını okur
  ("Almanya plakası"). Hollanda sarı zemin, Belçika kırmızı yazı.
- Ülke renkleri `globals.css` içinde tema token'ı; kontrastı
  `src/lib/theme-tokens.test.ts` ölçer, koyu temada da okunur. Sabit hex yok
  (`ui-contract.test.ts`).

## Riskler

- İsveç / Polonya / İsviçre plakası "D" görünebilir (Almanya deseniyle çakışır).
  Sıklık düşük, kabul edildi.
- `PlateBadge` kullanan ekranlarda rozet görünümü değişir.
- `technician-dashboard.test.ts` kaynakta `DashPlate` metnini arıyor; güncellenir.
- `surface.module.css` içindeki `.rowStart:has(> .plate[data-size="lg"])` hizası
  plaka sınıfına bağlı; taşınırken korunmalı.

## Test

- Ülke tanıma için tablo testleri: her ülke, çakışma örnekleri, yedek davranış.
- Dört CI kapısı; pano, iş emri listesi ve müşteri detayı telefonda (390) ve
  masaüstünde (1440).

## Uygulayıcıya kalan

Bant genişlikleri ve kod yazısının boyları, token adları, ekran okuyucu metninin
tam biçimi, `PlateBadge` boylarının `sm/md/lg`'ye eşlenmesi.
