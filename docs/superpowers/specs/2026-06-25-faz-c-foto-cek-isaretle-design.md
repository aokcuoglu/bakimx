# Faz C — Foto Çek + İşaretle (Photo Capture + On-Image Annotation) — Tasarım (Spec)

- **Tarih:** 2026-06-25
- **Durum:** Tasarım onaylandı — uygulama planı bekleniyor
- **Kapsam:** Birleşik iş emri akışının "Fotoğraf" parçasını gerçek bir **çek + resim üstüne hasar işaretle** deneyimine dönüştürmek; eski SVG hasar haritasını UI'dan emekliye ayırmak. Mobil-öncelikli.
- **İlgili:** `docs/superpowers/specs/2026-06-23-birlesik-is-emri-akisi-design.md` (Faz 4 "damage-map → photo pen-annotation"); Faz A/B (PR #5, branch `feat/unified-work-order-flow`).

---

## 1. Bağlam ve mevcut durum

- Wizard (Faz B sonrası 3 adım): **Müşteri & Araç → Kabul[iş emri oluşur] → Fotoğraf**. "Fotoğraf" adımı şu an yalnızca yer-tutucu bir bilgi kartı + "İş Emrine Git" bitir butonu.
- İş emri (intake + ServiceOrder) **Kabul adımında** oluşuyor → Fotoğraf adımına gelindiğinde `intakeFormId` mevcut; fotolar ona bağlanabilir.
- Hasar şu an: kabul **detay sayfasının "Hasar" sekmesinde** SVG zone-haritası (`src/components/damage/vehicle-damage-map.tsx`) + `DamageMark` tablosu (zone/damageType/severity/note).
- Hazır altyapı: `VehiclePhoto` modeli, storage provider soyutlaması (mock/S3), `POST/PUT/DELETE /api/intakes/photos`, `addPhotoAction` (FormData: intakeFormId, type, label, phase, note, file; `validateUploadFile` boyut/tip doğrular). **Çizim/canvas kütüphanesi YOK.**
- `VehiclePhotoType` enum'unda **`damage_detail`** değeri mevcut; `PhotoPhase` = intake/repair_progress/delivery.

## 2. Hedefler ve kapsam dışı (YAGNI)

### Hedefler
1. Tekrar kullanılabilir tek bir **`PhotoAnnotate`** bileşeni: cihaz kamerası/galeri → foto → resim üstüne serbest kalemle işaretle → flatten → yükle.
2. Wizard "Fotoğraf" adımını ve detay "Hasar" sekmesini bu bileşenle çalıştır.
3. Eski SVG hasar haritasını UI'dan kaldır; `DamageMark` tablosunu **sıfır migrasyonla** dormant bırak.

### Kapsam dışı (şimdilik)
- Vektör/düzenlenebilir overlay, orijinal foto'yu ayrı saklama (V1: yalnız flatten edilmiş JPEG).
- Uygulama içi canlı kamera (getUserMedia) — cihaz kamerası file-input yeterli.
- Şekiller (ok/daire/dikdörtgen) ve foto üstüne metin aracı — yalnız serbest kalem.
- `DamageMark` modelini silme / migrasyon.
- Eski `DamageMark` kayıtları için salt-okunur "legacy" görünüm (DB'de durur, UI'da gösterilmez; gerekirse sonra).
- Teslimat fotoları/OTP (Faz D/teslimat akışı).

## 3. Alınan kararlar

| # | Karar |
|---|-------|
| D1 | İşaret kaydı: **flatten** — kalem çizgileri foto'ya gömülür, tek `image/jpeg` olarak saklanır. Ayrı orijinal/vektör yok, sonradan düzenleme yok. |
| D2 | Çekim: **cihaz kamerası** `<input type="file" accept="image/*" capture="environment">` + galeriden seçim. |
| D3 | Eski SVG hasar haritası UI'dan **kaldırılır**; `DamageMark` tablosu + kayıtları **durur** (sıfır migrasyon). |
| D4 | Araç: **plain HTML5 Canvas** (ağır kütüphane yok). Serbest kalem + **renk** (varsayılan kırmızı) + **Geri Al** + **Temizle**. |
| D5 | Depolama: mevcut **`VehiclePhoto`** (`type=damage_detail`, `phase=intake`) + storage provider; opsiyonel not için mevcut `VehiclePhoto.note`. Yeni model/alan YOK. |
| D6 | **Sıfır Prisma migrasyonu.** |

## 4. Tasarım

### 4.1 `PhotoAnnotate` (yeni bileşen)

`src/components/app/photo-annotate.tsx` (client component).

- **Props:** `intakeFormId: string`, `onUploaded?: (photo: { id: string; fileUrl: string | null }) => void`, opsiyonel `label?` (varsayılan "Hasar"), `phase?` (varsayılan `"intake"`).
- **Tek sorumluluk:** bir foto al → işaretle → flatten edip `damage_detail` olarak yükle. Birden çok kez kullanılabilir (her "Kaydet" bir foto).

### 4.2 Capture + Canvas + Çizim (mobil-öncelikli)

- **Capture:** gizli `<input type="file" accept="image/*" capture="environment">`; "Foto çek / seç" butonu tetikler (mobilde kamera, masaüstünde dosya).
- **Downscale:** seçilen görsel `createImageBitmap`/`<img>` ile yüklenir, **uzun kenar ~1600px** olacak şekilde küçültülür (telefon fotoları 4-12MP; boyut + canvas belleği için zorunlu). Saf yardımcı: `fitDimensions(w, h, maxEdge) → { w, h }` (unit-test edilebilir).
- **Canvas (iki katman):** **base** canvas (downscale'lenmiş görsel, bir kez çizilir) + üstte **overlay** canvas (çizgiler). Çizim overlay'e **incremental** (pointermove ile son segment), Geri Al/Temizle overlay'i stroke listesinden **yeniden çizer** (büyük listede performans için base'i yeniden çizmeden). **DPR-aware** (`devicePixelRatio` ile ölçekli backing store, CSS ile görünür boyut). Çizim: **Pointer Events** (touch + mouse), `touch-action: none`.
- **Toolbar:** renk swatch'ları (kırmızı varsayılan + örn. mavi/yeşil/siyah/beyaz), **Geri Al** (stroke listesinden son stroke'u çıkar + yeniden çiz), **Temizle** (tüm stroke'lar). Çizgi kalınlığı sabit (mobilde rahat, örn. 4px @ CSS).
- **Stroke modeli (bellekte):** `Stroke = { color: string; points: {x,y}[] }[]`; her pointermove noktayı ekler; render = base görsel + tüm stroke'ları çiz. Geri-al bu listeden çalışır.

### 4.3 Flatten + Upload

- **"Kaydet":** base + overlay tek bir kompozit canvas'a çizilir → `canvas.toBlob(blob => ..., "image/jpeg", 0.85)` → `File([blob], "hasar-<ts>.jpg", {type:"image/jpeg"})`.
- **Yükleme:** mevcut `POST /api/intakes/photos` (FormData): `intakeFormId`, `type="damage_detail"`, `phase="intake"`, `label`, opsiyonel `note`, `file`. Yanıt `{success,id}` → `onUploaded`. `validateUploadFile` boyut/tip doğrular.
- **Çoklu foto:** her "Kaydet" sonrası canvas sıfırlanır (yeni foto için hazır); yüklenenler bileşenin altında thumbnail listesinde görünür (yeni yüklenenler local state + varsa mevcut `intake.photos`).
- **Opsiyonel not:** "Kaydet"ten önce küçük bir not input'u (hasar açıklaması) → `note`. Atlanabilir.

### 4.4 Entegrasyon

- **Wizard "Fotoğraf" adımı** (`intake-wizard.tsx`, `step === 4`): yer-tutucu içerik yerine `<PhotoAnnotate intakeFormId={intakeId} />` + mevcut **"Geri"** ve **"İş Emrine Git"** (bitir) butonları korunur. Foto **opsiyonel** (foto eklemeden de bitirebilir; detaydan sonra eklenebilir).
- **Detay "Hasar" sekmesi** (`intake-detail.tsx`): `<VehicleDamageMap .../>` bloğu yerine `<PhotoAnnotate intakeFormId={intake.id} />` + mevcut hasar/foto galerisi (yüklenen `damage_detail` fotoları). `vehicle-damage-map.tsx` artık import edilmez/kullanılmaz (dosya silinmez; dormant).
- **Atıl kod:** detay sayfasındaki SVG-harita'ya özel handler/state (`handleAddDamageMark`/`handleRemoveDamageMark`, damage form state) kullanılmıyorsa kaldırılır (lint temiz kalsın). `DamageMark` tablosu + `addDamageMarkAction`/`removeDamageMarkAction` server tarafı DURUR (silinmez) — dormant.

### 4.5 Veri / persistence

- Yalnız mevcut **`VehiclePhoto`** kullanılır (`type=damage_detail`, `phase=intake`, `fileUrl`/storage alanları, opsiyonel `note`). Storage provider mevcut akışla.
- `DamageMark` tablosu + eski kayıtlar DB'de kalır, UI'da gösterilmez.
- **Sıfır Prisma migrasyonu.**

## 5. Hata yönetimi

- Capture iptali → no-op (state değişmez).
- Görsel yüklenemedi/bozuk → kullanıcıya hata mesajı, canvas boş kalır.
- Çok büyük dosya → önce downscale; ayrıca `validateUploadFile` reddederse mesaj göster.
- Upload hatası → hata mesajı + "tekrar dene" (stroke'lar/foto korunur ki tekrar Kaydet denenebilsin).
- Bellek: downscale zorunlu; `createImageBitmap` varsa tercih, yoksa `<img>` fallback.

## 6. Bileşen değişiklikleri (dokunulan dosyalar)

- **Yeni:** `src/components/app/photo-annotate.tsx` (`PhotoAnnotate`).
- **Yeni (saf yardımcı, test için):** `src/lib/image/fit-dimensions.ts` (`fitDimensions`).
- **Değişen:** `src/components/app/intake-wizard.tsx` — "Fotoğraf" adımına `PhotoAnnotate`.
- **Değişen:** `src/components/app/intake-detail.tsx` — "Hasar" sekmesinde SVG harita → `PhotoAnnotate` + galeri; atıl damage-mark handler/state temizliği.
- **Dokunulmaz:** `vehicle-damage-map.tsx` (dormant), `DamageMark` modeli + server action'ları, `/api/intakes/photos`, storage, validations.

## 7. Mobil hususları

- Tam genişlik canvas; dokunmatik çizim (`touch-action: none`, Pointer Events).
- Capture butonu büyük dokunmatik hedef; toolbar parmakla rahat.
- Downscale ile yükleme boyutu/performansı kontrol altında.
- Canvas DPR-aware → retina ekranda net.

## 8. Test ve QA

- **Unit:** `fitDimensions` saf yardımcısı (oran koruma, uzun-kenar sınırı, küçük görselde büyütmeme). Mevcut `bun test` setine eklenir.
- **Manuel/görsel (:3000 demo):** mobilde foto çek → kalemle işaretle → renk değiştir → geri al → temizle → kaydet → thumbnail görünür → çoklu foto → wizard'da bitir; detay "Hasar" sekmesinde aynı akış; SVG haritanın kalktığını doğrula.
- typecheck + lint + build kapısı.

## 9. Açık sorular

Kritik açık soru yok (D1–D6 net). Varsayılanlar: downscale uzun-kenar 1600px / JPEG q0.85, çizgi kalınlığı sabit, opsiyonel not alanı dahil, eski DamageMark UI'da gizli. Uygulama ayrıntıları `writing-plans` aşamasında.
