# Birleşik İş Emri Akışı — Tasarım (Spec)

- **Tarih:** 2026-06-23
- **Durum:** Tasarım onaylandı — uygulama planı bekleniyor
- **Kapsam:** Araç Kabulleri (`VehicleIntakeForm`) ve İş Emirleri (`ServiceOrder`) akışlarının tek bir "İş Emri" deneyiminde birleştirilmesi + 6 maddelik değişiklik seti.
- **İlgili:** `docs/ANALYSIS.md` §8 roadmap, Trello (Feature).

---

## 1. Bağlam ve Mevcut Durum

### 1.1 İki akış bugün nasıl bağlı

- **`VehicleIntakeForm` (Araç Kabul):** müşteri, araç, km, şikayet, fotoğraflar, hasar işaretleri, OTP onayı. 6 adımlı yatay sihirbaz — `src/components/app/intake-wizard.tsx` (Müşteri → Araç → Kabul → Fotoğraf → Hasar → Onay/OTP).
- **`ServiceOrder` (İş Emri):** kalemler (parça/işçilik), ödeme, teknisyen ataması, durum geçişleri, PDF/WhatsApp çıktısı, public passport. Detay: `src/components/app/order-detail.tsx`.
- **Kritik bulgu:** `ServiceOrder` zaten kabule **1:1 bağlı** (`ServiceOrder.intakeFormId @unique`) ve **müşteri/aracı doğrudan değil, kabul üzerinden** alıyor (ServiceOrder'da Customer/Vehicle FK'sı yok). Yani bir iş emri her zaman bir kabulden doğuyor; sadece bu "kabulü iş emrine çevir" adımı bugün **manuel** (`src/app/(app)/orders/new/page.tsx` + `src/components/app/new-order-selector.tsx`).

> **Sonuç:** "Birleştirme" = bu manuel dönüşüm adımını kaldırıp tek akış + tek ekran yapmak. Büyük bir yeniden yazım değil, kademeli ve düşük riskli bir iş.

### 1.2 İlgili mevcut dosyalar

| Alan | Dosya |
|------|-------|
| Kabul sihirbazı | `src/components/app/intake-wizard.tsx` |
| Kabul giriş/detay | `src/app/(app)/intakes/new/page.tsx`, `src/app/(app)/intakes/[id]/page.tsx` |
| Kabul server action | `src/app/(app)/intakes/actions.ts` (createIntake, addPhoto, addDamageMark…) |
| OTP/onay | `src/app/(app)/intakes/approval-actions.ts` (requestApproval, verifyOtp) |
| Manuel dönüşüm (kalkacak) | `src/app/(app)/orders/new/page.tsx`, `src/components/app/new-order-selector.tsx` |
| İş emri oluşturma | `src/app/(app)/orders/actions.ts` (`createServiceOrderAction`) |
| İş emri detay | `src/app/(app)/orders/[id]/page.tsx`, `src/components/app/order-detail.tsx` |
| Müşteri/araç API | `src/app/api/customers/route.ts`, `src/app/api/vehicles/route.ts` |
| Hasar haritası (kalkacak) | `src/components/damage/vehicle-damage-map.tsx` |
| Durum geçişleri | `src/lib/status-transitions.ts` |
| Validasyon | `src/lib/validations/intake.ts`, `src/lib/validations/order.ts` |
| Depolama | `src/lib/storage/` (mock / s3) |
| SMS/OTP altyapısı | `src/lib/communications/` (NetGSM) |
| Şema | `prisma/schema.prisma` |

---

## 2. Hedef ve Kapsam Dışı (YAGNI)

### 2.1 Hedefler
1. Araç kabulü ve iş emrini tek akış + tek ekran olarak sunmak; manuel dönüşümü kaldırmak.
2. Müşteri ve aracı **tek searchable input** üzerinden seçmek; kayıt yoksa **inline** oluşturmak.
3. Araç sahibi değişebilir; arama daima güncel sahibi getirir.
4. Akış navigasyonu **dikey kaydırmalı** (Instagram story mantığı), mobil-öncelikli.
5. Hasar haritasını kaldırıp yerine **fotoğraf üzeri kalem** işaretleme.
6. OTP'yi kabulden kaldırıp **teslim** anına taşımak (KVKK).

### 2.2 Kapsam dışı (şimdilik)
- Sahiplik **geçmiş zaman çizelgesi** (history tablosu) — sadece güncel sahip tutulur.
- Fotoğraf **orijinalini ayrıca saklama** — yalnızca işaretli (flatten) sürüm yüklenir.
- `DamageMark` modelini DB'den silme — eski kayıtlar için kalır, sadece yeni oluşturma UI'ı yok.
- Quote/Appointment → iş emri dönüşümleri (mevcut haliyle kalır, bu işin parçası değil).

---

## 3. Alınan Kararlar

| # | Karar | Seçim |
|---|-------|-------|
| D1 | Birleştirme derinliği | **Akışı birleştir, kaydı otomatik oluştur** (iki tablo arkada kalır, mevcut ödeme/teknisyen/PDF/passport kodu aynen çalışır) |
| D2 | Araç sahipliği | **Güncel sahip + "sahip değiştir" aksiyonu** (geçmiş çizelgesi yok) |
| V1 | Fotoğraf annotation | Orijinal ayrıca saklanmaz; sadece işaretli sürüm |
| V2 | Rota/menü | `/intakes` rotaları `/orders`'a katlanır/yönlenir; tek menü "İş Emirleri" |

---

## 4. Tasarım

### 4.1 Birleşik akış mimarisi ve yaşam döngüsü

- Kullanıcı yeni akışa girer. **Müşteri + araç seçilip şikayet girilince**, `VehicleIntakeForm` + `ServiceOrder` **tek transaction'da birlikte** oluşturulur (status `draft`). Bunun için `createServiceOrderAction` mantığı, kabulü ayrı bir ön-koşul olarak değil, kabulle **aynı işlemde** çalışacak şekilde birleştirilir.
- Sonraki paneller **canlı taslağı** düzenler. **Her panel ileri geçişinde otomatik kaydedilir (autosave)** → #4'teki "yanlış veri girdiysem hızlı geri dön" ihtiyacı veri kaybı olmadan karşılanır.
- Akış tamamlanınca status `in_progress`'e geçer.
- **Manuel dönüşüm kaldırılır:** `/orders/new` + `new-order-selector.tsx` devre dışı; `/orders/new` doğrudan yeni birleşik akışa yönlenir.
- **Tek liste/detay:** Birleşik kayıt "İş Emri" olarak sunulur. `/intakes` listesi `/orders`'a katlanır, `/intakes/new` → yeni akışa yönlenir. Detay sayfası mevcut `order-detail.tsx` temel alınır (müşteri/araç/fotoğraf kartları zaten var).

#### Durum akışı değişikliği
- Kabul tarafındaki `waiting_approval → approved` **onay kapısı kaldırılır** (intake OTP'si #6 ile kalkıyor). Yeni akış: `draft → in_progress → ready_for_delivery → delivered | cancelled`.
- `IntakeStatus` enum **değerleri korunur** (eski satırları bozmamak için); yalnızca `src/lib/status-transitions.ts` içindeki `INTAKE_TRANSITIONS` haritası güncellenir (`draft → in_progress` doğrudan; approval gate çıkar). `updateIntakeStatusAction`'daki "manuel approval engeli" mantığı yeniden değerlendirilir.
- `OrderStatus` ve ticari akış (waiting_parts, ready_for_delivery vb.) **aynen kalır**.

### 4.2 Tek arama kutusu + inline oluşturma (#1, #2)

- **Tek searchable input:** Kullanıcı plaka **veya** ad/telefon yazar. Yeni endpoint `GET /api/search/customer-vehicle?q=` hem araçlarda (plaka/VIN) hem müşterilerde (ad/şirket/telefon) arar; birleşik, etiketli sonuç döner:
  - Araç sonucu → `34ABC123 — Renault Clio — Sahip: Ahmet Yılmaz`; seçince **araç + güncel sahibi** birlikte seçilir.
  - Müşteri sonucu → `Ahmet Yılmaz — 0532…`; seçince müşteri seçilir, araçları altta listelenir/seçilir.
  - Tüm sorgular `workshopId` ile sınırlı (tenant izolasyonu).
- **Sonuç yoksa:** "«…» için kayıt bulunamadı" + **"Oluştur"** ve **"Oluştur ve Düzenle"** linkleri → aynı ekranda **modal**.
- **Modal alanları (hepsi `Customer`/`Vehicle` modelinde mevcut → şema değişikliği yok):**
  - Müşteri: ad/soyad ya da şirket adı, telefon, **email**, **bireysel/Kurumsal** (`type`), **VIP** (`tag`), **TC** (`identityNumber`) / **VKN** (`taxNumber`).
  - Araç: plaka, marka, model, yıl…
  - "Oluştur" → kaydeder ve seçer; "Oluştur ve Düzenle" → kaydeder ve tam düzenleme sayfasını açar.
  - Mevcut `POST /api/customers` ve `POST /api/vehicles` kullanılır.

### 4.3 Araç sahipliği (#3)

- Arama daima `Vehicle.customerId` = **güncel sahibi** getirir.
- Araç seçilince picker'da inline **"Sahip değiştir"** aksiyonu: yeni/var olan müşteri seçilir → `Vehicle.customerId` güncellenir (audit log ile). Yeni server action (örn. `changeVehicleOwnerAction`), `workshopId` doğrulamalı.
- Eski kabul/iş emirleri kendi `customerId` snapshot'ını sakladığı için **servis geçmişi bozulmaz**. **Şema değişikliği yok.**

### 4.4 Dikey kaydırmalı akış (#4)

- Yatay Next/Prev yerine **tam ekran panel + dikey kaydırma** (Instagram story): yukarı kaydır = sonraki, aşağı = önceki. Mobil-öncelikli; dokunmatik swipe + CSS scroll-snap, masaüstünde ok/buton fallback.
- **Serbest geri-ileri:** autosave sayesinde kullanıcı istediği panele dönüp düzeltebilir. Zorunlu alan eksikse yalnızca son "Tamamla" engellenir; panel geçişi engellenmez (akıcı UX).
- **Panel sayısı 3'e iner:** ① Müşteri+Araç (tek arama) → ② Kabul detayı (km, şikayet, not) → ③ Fotoğraf+işaretleme. (Hasar adımı ve OTP adımı kaldırılır.)
- Yeni bileşen `intake-wizard.tsx`'in yerini alır (ör. `work-order-flow.tsx`); ilerleme göstergesi dikey yapıya uyarlanır. Yükleme durumları `BrandSpinner` ile (skeleton değil).

### 4.5 Fotoğraf + kalem / hasar haritası kaldırma (#5)

- Tıklanabilir SVG **hasar haritası kaldırılır** (akış adımı + UI). `vehicle-damage-map.tsx` flow'dan çıkar. `DamageMark` modeli **eski kayıtlar için DB'de kalır**; yeni oluşturma UI'ı olmaz.
- Fotoğraf çek/seç sonrası **canvas üzeri kalem aracı**: parmak/kalemle çizim (pointer events), 2-3 renk (kırmızı varsayılan), geri-al, temizle. Onayda **çizimler görüntüye gömülür (flatten)** ve işaretli görüntü yüklenir.
- Yükleme mevcut `addPhotoAction` + `src/lib/storage/` (mock/s3) ile yapılır; flatten edilmiş blob yüklenir. **Şema değişikliği yok** (annotation flag MVP'de eklenmez).
- En yüksek eforlu/riskli yeni parça (mobil dokunmatik canvas).

### 4.6 Teslim OTP'si (#6)

- Intake'teki OTP **kaldırılır** (sihirbaz adım 6 + intake approval gate çıkar).
- OTP **teslim anına** taşınır: iş emri `ready_for_delivery → delivered` geçişinde tetiklenir. "Teslim Et" → müşteri telefonuna OTP → kod girilince teslim + KVKK onayı kaydı.
- **Mevcut altyapı yeniden kullanılır:** `ApprovalRequest` (alan `approvalType` zaten var → `"vehicle_delivery"`), `verifyOtpAction`/`requestApprovalAction` benzeri akış, NetGSM. KVKK teslim metni `approvalTextVersion`'a snapshot'lanır; `approvedAt`/`ipAddress`/`userAgent` KVKK denetim kaydını oluşturur. **Şema değişikliği yok.**

---

## 5. Veri Modeli Değişiklikleri

> **Bu birleştirme Prisma migrasyonu gerektirmiyor.** Tüm gerekli alanlar mevcut.

- `Customer` — değişiklik yok (email, tag=vip, type=corporate, identityNumber, taxNumber mevcut).
- `Vehicle` — değişiklik yok (tek `customerId` FK; "sahip değiştir" = bu alanın güncellenmesi).
- `VehicleIntakeForm` — şema değişmez; enum değerleri korunur, yalnızca geçiş haritası (kod) güncellenir.
- `ServiceOrder` — değişiklik yok; kabulle aynı işlemde otomatik oluşturulur.
- `ApprovalRequest` — değişiklik yok; `approvalType` "vehicle_delivery" olarak kullanılır.
- `DamageMark` — korunur (eski veri), yeni oluşturma UI'ı yok.
- `VehiclePhoto` — değişiklik yok; işaretli görüntü mevcut alanlara yüklenir.

---

## 6. API / Server Action Değişiklikleri

- **Yeni:** `GET /api/search/customer-vehicle?q=` — birleşik müşteri+araç araması (workshopId scoped).
- **Yeni:** `changeVehicleOwnerAction(vehicleId, newCustomerId)` — sahip değiştirme (auth + workshopId + audit).
- **Değişen:** kabul + iş emri oluşturmayı tek transaction'da yapan birleşik action (`createIntakeAction` + `createServiceOrderAction` birleşimi).
- **Değişen:** `INTAKE_TRANSITIONS` (approval gate kaldırma) ve `updateIntakeStatusAction`.
- **Yeniden hedeflenen:** teslim OTP'si için `requestApproval`/`verifyOtp` akışı (`approvalType: vehicle_delivery`), `ready_for_delivery → delivered` geçişine bağlanır.
- **Kaldırılan/yönlendirilen:** `/orders/new` manuel seçim akışı; `new-order-selector.tsx`.
- **Mevcut, korunan:** `POST /api/customers`, `POST /api/vehicles`, `addPhotoAction`, ödeme/teknisyen/passport action'ları.

---

## 7. Fazlandırma (bağımsız sevk edilebilir)

1. **Faz 1 — Veri & birleşik kayıt:** otomatik order oluşturma, manuel dönüşümün kaldırılması, durum akışı sadeleştirme, "sahip değiştir" aksiyonu.
2. **Faz 2 — Tek arama + inline oluşturma** (#1, #2).
3. **Faz 3 — Dikey kaydırmalı akış** (#4).
4. **Faz 4 — Fotoğraf kalem + hasar haritası kaldırma** (#5).
5. **Faz 5 — Teslim OTP'si** (#6).

> Her faz kendi lint/typecheck/build + manuel QA ile kapanır; ayrı commit/PR olarak sevk edilebilir.

---

## 8. Riskler ve Azaltma

| Risk | Azaltma |
|------|---------|
| `/orders/new`, `/intakes/*` kullanan link/menüler kırılır | Eski rotaları yönlendir; menüyü tek "İş Emirleri"ne indir; smoke test. |
| Durum akışı değişimi eski kayıtları etkiler | Enum değerlerini koru; yalnızca geçiş haritasını değiştir; eski satırları migrate etme. |
| Autosave yarım/boş taslak üretir | Taslaklar `draft` statüsünde listede görünür; ileride cleanup job (şimdilik kabul edilen tradeoff). |
| Mobil dokunmatik canvas davranışı | Pointer events + erken cihaz testi; en riskli parça Faz 4'te izole. |
| Tenant sızıntısı | Her yeni sorgu/action `requireAuth()` → `workshopId`; client param'a güvenme. |

---

## 9. Test ve QA

- Birleşik arama doğruluğu (plaka + ad/telefon, yalnızca kendi workshop'u).
- Inline oluşturma → seçim → kayıt; "Oluştur ve Düzenle" yönlendirmesi.
- Sahip değiştir → arama güncel sahibi getiriyor; eski iş emirleri eski müşteriyi koruyor; audit log.
- Mobilde dikey swipe + serbest geri-dönüş + autosave; zorunlu alan eksikken "Tamamla" engeli.
- Fotoğraf çek → kalemle işaretle → flatten → yükle; hasar adımının yokluğu.
- Teslim OTP: ready_for_delivery → OTP → delivered; KVKK kaydı; intake'te OTP'nin olmadığının doğrulanması.
- Her faz: install / lint / typecheck / build; anlamlı değişimde manuel QA.

---

## 10. Açık Sorular

Şu an kritik açık soru yok; varsayılanlar (V1, V2) onaylandı. Uygulama planı sırasında yüzeye çıkan ayrıntılar `writing-plans` aşamasında netleştirilecek.
