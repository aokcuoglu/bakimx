# Ruhsat Tarayıcı — Akıllı Belge Yakalama (Smart Document Capture)

- **Tarih:** 2026-06-23
- **Durum:** Tasarım onaylandı — implementasyon planı bekleniyor
- **Ekran:** `/smart-capture/registration` (Ruhsat Okuma)
- **Trello bağlamı:** Feature

## 1. Bağlam ve Problem

Mevcut Ruhsat Okuma ekranı **canlı kamera kullanmıyor**. `SmartCaptureRegistration` bileşeni yalnızca
`<input type="file" accept="image/...">` ile galeri/dosya seçtiriyor; çerçeve overlay'i veya hizalama
rehberi yok (`src/components/app/smart-capture-registration.tsx`). Projede hiçbir yerde `getUserMedia`
tabanlı canlı kamera yok — `intake-detail.tsx` bile native `<input capture="environment">` kullanıyor.

Sonuç: kullanıcı ruhsatı kötü açıyla, kesik, eğik veya bulanık çekebiliyor → OCR doğruluğu düşüyor ve
"ruhsat tam okundu mu" güvencesi yok.

**Hedef:** Bankaların kimlik kartı tarama deneyimi gibi — canlı kamera üzerinde gerçek zamanlı belge-kenarı
tespiti, belge çerçeveyi doldurup sabitlenince otomatik çekim ve perspektif düzeltme (deskew + crop) ile
OCR'a temiz görüntü besleme.

Bu, projeye **yeni bir desen** ekler (canlı kamera + WASM tabanlı CV). Onaylanan akıllılık seviyesi:
**gerçek zamanlı belge-kenarı tespiti + otomatik yakalama.**

## 2. Hedefler / Hedef-dışı

**Hedefler**
- Canlı kamera (arka kamera) + gerçek zamanlı ruhsat konturu overlay.
- Belge çerçeveyi yeterince doldurup birkaç kare sabit kalınca **otomatik çekim**.
- Perspektifi düzeltilmiş, kırpılmış görsel üretip **mevcut OCR akışına** girdi olarak verme.
- **Her zaman** manuel deklanşör + dosya/galeri yükleme fallback.
- Otomatik-çekim karar mantığının saf, birim-test edilebilir fonksiyon olması.

**Hedef-dışı (YAGNI)**
- Sunucu tarafı OCR/confirm uçlarında değişiklik (`/api/smart-capture/ocr`, `/api/smart-capture/confirm`).
- Çok adımlı ön/arka yüz tarama akışı.
- Özel/slim OpenCV.js derlemesi (ileride bundle optimizasyonu olarak değerlendirilir).
- Her ruhsat alanı için ayrı vurgulama kutucukları.

## 3. Seçilen Yaklaşım

**jscanify + self-hosted OpenCV.js (lazy-load).**

- **jscanify** (`/puffinsoft/jscanify`) tam bu iş için yazılmış ince bir katman:
  - `new jscanify()` — scanner örneği (global `window.cv` üzerinden çalışır).
  - `scanner.highlightPaper(canvas)` → tespit edilen belge konturu çizili bir canvas (canlı overlay).
  - `scanner.findPaperContour(cv.imread(src))` + `scanner.getCornerPoints(contour)` → 4 köşe noktası
    (`topLeftCorner`, `topRightCorner`, `bottomLeftCorner`, `bottomRightCorner`) → hizalama/doluluk kararı.
  - `scanner.extractPaper(src, outW, outH)` → perspektifi düzeltilmiş, kırpılmış canvas.
- **OpenCV.js** (~8 MB WASM) sadece tarayıcı açıldığında lazy-load edilir; ana JS bundle'a girmez,
  ilk yüklemeden sonra tarayıcı cache'ler.

**Reddedilen alternatifler:** ham OpenCV.js (aynı 8 MB, çok daha fazla elle CV kodu) ve WASM'sız özel
dedektör (değişken ışık/arka planda kırılgan, perspektif düzeltme yok, yüksek emek).

## 4. Bağımlılıklar

- `jscanify` — npm'den kurulur ve `package.json`'da **sürümü sabitlenir** (kurulumdaki güncel stabil
  sürüm), ES module olarak import edilir.
- **OpenCV.js 4.x WASM build**, repoda `public/opencv/` altında self-host edilir
  (`opencv.js` + gerekiyorsa eşlik eden `.wasm`). Başlangıç referansı jscanify'ın belgelediği **4.7.0**;
  daha yeni bir 4.x yalnızca jscanify ile uyumu doğrulandıktan sonra kullanılır.
- **Repo etkisi:** `public/`'e ~8 MB statik dosya eklenir (bundle'a değil, statik servis). Kabul edildi;
  ileride slim build ile küçültülebilir.

## 5. Mimari ve Dosyalar

**Yeni**
- `src/components/app/registration-scanner.tsx` (client) — kamera akışı, canlı overlay, otomatik çekim,
  manuel deklanşör, izin/hata durumları. `next/dynamic` ile `ssr: false` yüklenir (SSR'da `window`/`cv`
  erişimini önlemek için). jscanify, OpenCV hazır olduktan sonra **lazy import** edilir.
  - Props: `{ onCapture(file: File): void; onClose(): void }`.
- `src/lib/ocr/opencv-loader.ts` — `loadOpenCv(): Promise<OpenCvModule>` **idempotent singleton**:
  script'i bir kez enjekte eder, `cv.onRuntimeInitialized`'ı bekler, timeout/yükleme hatasında reject eder.
  Tekrar çağrılırsa aynı promise'i döndürür.
- `src/lib/ocr/document-detection.ts` — **saf mantık** (jscanify/DOM bağımsız, birim test edilir):
  - `shouldAutoCapture(input): { ready: boolean; reason: string }`
  - geometri yardımcıları: dörtgen alanı, doluluk oranı, merkezleme/kenar payı, sabitlik (kare-arası
    köşe hareketi), blur skoru değerlendirmesi.

**Değişen**
- `src/components/app/smart-capture-registration.tsx` — "upload" adımına **birincil "Kamera ile Tara"**
  butonu eklenir; bir `scannerOpen` state'i ile `RegistrationScanner` tam ekran açılır. Scanner
  `onCapture(file)` ile **mevcut `handleFileSelected(file)`** fonksiyonunu çağırır. Mevcut "Dosyadan Yükle"
  / sürükle-bırak akışı **fallback olarak aynen korunur**. Sunucu tarafı ve "confirm" onay adımı değişmez.

**Tipleme:** OpenCV.js resmi TS tipleri yok. Kullandığımız üyeler (`imread`, `Mat`, `Laplacian`,
`meanStdDev`, `cvtColor`, `delete()` vb.) için `opencv-loader.ts` içinde **dar bir `OpenCvModule` arayüzü**
tanımlanır; `any` kullanımı bu arayüzle sınırlı/gerekçeli tutulur (CLAUDE.md strict TS kuralı).

## 6. UX Akışı ve Durumlar

1. **Giriş:** Ruhsat ekranında birincil "Kamera ile Tara" butonu + ikincil "Dosyadan Yükle".
2. **Açılış / yükleniyor:** Tam ekran tarayıcı açılır; OpenCV.js yüklenirken **BrandSpinner** (proje tercihi:
   skeleton değil) ve "Kamera hazırlanıyor…" mesajı.
3. **İzin:** `getUserMedia({ video: { facingMode: "environment" } })`. Reddedilirse → bilgilendirme +
   "Dosyadan Yükle" fallback'ine yönlendirme.
4. **Canlı tarama:** `<video playsInline muted>` + üstte canvas overlay. Her ~100 ms'de küçültülmüş kareden
   kontur tespit edilir. `getCornerPoints` ile elde edilen köşelerden **kendi poligonumuz** çizilir
   (renk durumlarını — nötr/yeşil — kontrol edebilmek için; `highlightPaper`'a bağlı kalmadan). Ruhsat
   oranında sabit **rehber çerçeve** + talimat: "Ruhsatı açıp çerçeveye yerleştirin."
   - Belge yok/zayıf: çerçeve **nötr/primary (lacivert)**.
   - Belge hizalandı (doluluk + sabitlik + netlik koşulları): çerçeve **yeşil (success)** + kısa countdown.
5. **Otomatik çekim:** Koşullar ~`COUNTDOWN_MS` boyunca korunursa tam çözünürlükte `extractPaper` ile
   düzleştirilmiş kırpma alınır. Koşul bozulursa countdown iptal, taramaya dönülür.
6. **Manuel override:** Her an görünür **deklanşör** butonu (otomatik tetiklenmese de çeker) + destekleyen
   cihazlarda **flaş/torch** toggle. Basıldığında: **geçerli belge tespiti varsa** `extractPaper`
   düzleştirilmiş kırpma; **tespit yoksa tam kare** (kırpmasız/perspektifsiz) gönderilir — bu, "orijinal
   tam kare" fallback yoludur.
7. **Önizleme:** Düzleştirilmiş kırpma gösterilir → "Kullan" / "Tekrar çek".
   - "Kullan" → `onCapture(file)` → mevcut OCR akışı (processing → confirm).
   - "Tekrar çek" → 4. adıma döner.
8. **Kapat:** "X/Geri" → stream durdurulur, `onClose()`.

## 7. Otomatik Çekim Karar Mantığı (saf fonksiyon)

```
shouldAutoCapture({
  corners,            // getCornerPoints sonucu (downscale koordinatları) | null
  frameWidth,         // downscale edilmiş tespit karesi genişliği
  frameHeight,
  history,            // son N karenin köşe konumları (sabitlik için)
  blurScore,          // Laplacian varyansı (netlik)
}): { ready: boolean; reason: string }
```

**Koşullar (hepsi sağlanmalı):**
- `corners` mevcut ve **konveks dörtgen** oluşturuyor.
- **Doluluk:** dörtgen alanı / kare alanı ≥ `FILL_MIN`.
- **Kesilmeme:** her köşe kare sınırlarının `EDGE_MARGIN` kadar içinde (kenara yapışık = kesik kabul, ret).
- **Sabitlik:** son `STABLE_FRAMES` karede köşelerin maksimum hareketi `STABILITY_EPS` pikselden az.
- **Netlik:** `blurScore ≥ SHARP_MIN`. Blur, gri tonlu kare/ROI üzerinde **`cv.Laplacian` varyansı** ile
  ölçülür (OpenCV zaten yüklü).

**Başlangıç sabitleri (tunable):**
- `DETECT_INTERVAL_MS = 100` (~10 fps), `DETECT_MAX_WIDTH = 480` (tespit için küçültme)
- `FILL_MIN = 0.55`, `EDGE_MARGIN = 0.015`
- `STABLE_FRAMES = 6`, `STABILITY_EPS ≈ 6` (downscale px)
- `SHARP_MIN = 100` (cihaz/ışıkta kalibre edilecek)
- `COUNTDOWN_MS = 600`
- `CAPTURE_LONG_EDGE = 1600` (extractPaper çıktısı uzun kenar hedefi)

**extractPaper boyutu:** köşe noktalarından (tam çözünürlük) kenar uzunlukları hesaplanır;
`wAvg = ort(üst, alt)`, `hAvg = ort(sol, sağ)`; uzun kenar `CAPTURE_LONG_EDGE` olacak şekilde ölçeklenip
`extractPaper(image, outW, outH)` çağrılır. Böylece tespit edilen ruhsatın **gerçek oranı korunur**
(format farklılıklarına toleranslı).

## 8. Mevcut OCR Akışına Entegrasyon

```
extractPaper(...) -> HTMLCanvasElement
  -> canvas.toBlob(blob, "image/jpeg", 0.9)
  -> new File([blob], "ruhsat-capture.jpg", { type: "image/jpeg" })
  -> onCapture(file)
  -> handleFileSelected(file)            // smart-capture-registration.tsx (mevcut)
  -> prepareRegistrationImage(file)      // format/boyut doğrulama (mevcut)
  -> POST /api/smart-capture/ocr         // değişmez
  -> "confirm" adımı (alan doğrulama)    // değişmez
```

Düzleştirilmiş + kırpılmış + deskew görüntü, OCR girdisini iyileştirir → "ruhsat tam okundu" hedefine
doğrudan hizmet eder. Belge tespit edilemeden manuel çekimde aynı `File` üretimi **tam kareden** yapılır
(`extractPaper` atlanır). Sunucu sözleşmesi her iki durumda da hiç değişmez.

## 9. Hata Yönetimi ve Fallback Zinciri

1. **Güvenli bağlam yok** (`!window.isSecureContext`, HTTPS/localhost değil) → kamera devre dışı,
   açıklama + "Dosyadan Yükle". (Prod `app.bakimx.com` HTTPS, dev `localhost`: ✓.)
2. **getUserMedia desteklenmiyor / izin reddi** → mesaj + dosya yükleme.
3. **OpenCV.js yüklenemedi / timeout** (`loadOpenCv` reject) → mesaj + dosya yükleme; tarayıcı kapanmaz,
   kullanıcı tekrar deneyebilir.
4. **Tespit hiç başarılamıyor** (kötü ışık/arka plan) → otomatik çekim tetiklenmez ama **manuel deklanşör**
   her zaman çalışır.
5. **Son güvence:** çıktı yine mevcut **confirm** adımından geçer; zorunlu alanlar (plaka, marka, model,
   telefon) ve düşük güven uyarıları korunur → otomasyon hatası insan kontrolüyle yakalanır.

## 10. Performans

- Tespit, küçültülmüş karede (`DETECT_MAX_WIDTH ≈ 480`) ve `DETECT_INTERVAL_MS` ile throttle'lı çalışır
  (Context7 örneğindeki 10 ms/100 fps mobil için fazla — ~10 fps hedeflenir).
- OpenCV `Mat` nesneleri her karede **`.delete()` ile serbest bırakılır** (WASM bellek sızıntısı önlenir).
- Çekim **tam çözünürlükte** yapılır (sadece tespit küçültülür).
- Bileşen unmount/`onClose`'da: `setInterval`/`requestAnimationFrame` durdurulur, tüm `MediaStreamTrack`
  `.stop()` edilir, video `srcObject = null`.

## 11. Güvenlik / Tenant İzolasyonu

- Özellik tamamen **client-side görüntü yakalama**. Yeni sunucu veri yolu yok; tek güven sınırı, zaten
  auth + workshop izolasyonu uygulayan mevcut `/api/smart-capture/*` uçlarıdır (değişmez).
- Kamera için **güvenli bağlam (HTTPS/localhost) zorunlu**; secure-context kontrolü eklenir.
- Görüntü ağ üzerinden sadece mevcut OCR ucuna gider (bugünküyle aynı veri akışı).

## 12. Test / QA

**Birim testleri** (`document-detection.ts`):
- `shouldAutoCapture`: doluluk altı/üstü, kenar kesilmesi, sabit/oynak köşe geçmişi, blur altı/üstü
  kombinasyonları → beklenen `ready`/`reason`.
- Geometri yardımcıları: dörtgen alanı, doluluk oranı, extractPaper boyut hesabı.

**Manuel QA:**
- iOS Safari + Android Chrome, **HTTPS** üzerinde, gerçek/örnek ruhsatla (açık iki sayfa).
- Otomatik çekim: iyi ışık (otomatik tetiklenmeli), kötü ışık/eğik (tetiklenmemeli, manuel çalışmalı).
- Fallback: kamera izni reddi, kamerasız masaüstü, yavaş ağda WASM yükleme (spinner → fallback).
- Çıktının mevcut confirm akışına doğru aktığı ve alanların okunduğu.
- Bellek/performans: uzun süre açık kalınca takılma/ısınma gözlemi (Mat temizliği).

## 13. Riskler ve Önlemler

| Risk | Önlem |
|------|-------|
| ~8 MB WASM yükleme süresi (mobil/yavaş ağ) | Lazy-load + tarayıcı cache + BrandSpinner + manuel/upload fallback |
| Değişken ışık/arka planda yanlış tespit | Doluluk + sabitlik + netlik eşikleri; manuel override; sonradan confirm doğrulaması |
| jscanify (medium reputation, `@master` CDN) kırılganlığı | npm'den **sürüm sabit**; OpenCV.js **self-host** (3. parti CDN'e bağımlılık yok) |
| iOS Safari getUserMedia kısıtları (autoplay/inline) | `<video playsInline muted>`, kullanıcı jesti ile başlatma |
| WASM `Mat` bellek sızıntısı | Her karede `.delete()`; unmount'ta stream/temizlik |
| Repo +8 MB | Kabul edildi; ileride slim OpenCV build |

## 14. Çözülen Kararlar (onaylı)

1. **OpenCV.js self-host** (`public/`'te ~8 MB), CDN değil. ✓
2. **OCR girdisi = `extractPaper` düzleştirilmiş kırpma**; belge tespit edilemezse manuel çekim tam kareyi
   (kırpmasız) gönderir. ✓
3. **Kamera birincil + dosya yükleme fallback korunur** (yükleme kaldırılmaz). ✓
