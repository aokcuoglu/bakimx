# İş Emri Parça Satırında Inline Düzenleme — Tasarım

**Tarih:** 2026-07-08
**Durum:** Onaylandı (implementasyon bekliyor)
**Kapsam:** İş emri detayı → "Parça & İşçilik" sekmesi → `PartsLaborCard` / `ItemRow`

## 1. Amaç

Kullanıcı, kullanılan parça satırında aşağıdakileri **tablo üzerinde inline** (ayrı ekrana/modala gitmeden) yapabilmeli:

- Adedi hızlıca artırıp azaltmak (stepper `[−] N [+]`)
- Markayı dropdown üzerinden seçmek
- Kategoriyi dropdown üzerinden, alt kategorileri cascade ("next/next") biçimde ekran değişmeden seçmek
- Fiyatı kolayca revize etmek

## 2. Mevcut durum (kod tabanı)

- **Render:** `src/components/app/order-management-panel.tsx` → `PartsLaborCard` (satır ~149) ve `ItemRow` (satır ~447).
- **Model:** Prisma `ServiceOrderItem` (`prisma/schema.prisma`) alanları: `type, name, sku, unit, quantity, unitPrice (kuruş), totalPrice (kuruş), partId, tecdocArticleId, note`. **Marka/kategori kolonu yok.** Marka bugün `note` alanına yazılıyor (TecDoc `supplierName`), kategori hiç saklanmıyor.
- **Mutasyonlar:** Yalnızca `addOrderItemAction` ve `removeOrderItemAction` (`src/app/(app)/orders/actions.ts`), `/api/orders/items` route'unda `POST`/`DELETE`. **Güncelleme yok** — miktar/fiyat değişimi bugün sil-yeniden ekle ile yapılıyor. Her mutasyon sonrası `window.location.reload()`.
- **Stok:** `partId`'ye bağlı parça eklenince `reserveStockInTx` ile stok düşer + `StockMovement (out)`; silinince `returnStockInTx` ile iade edilir.
- **Hazır kaynaklar:** TecDoc araç-özel kategori ağacı (`tecdoc-part-picker.tsx`, `GET /api/tecdoc/categories?vehicleId=`, `CategoryNode` ağacı) ve TecDoc parça markaları (`getPartBrands`, `GET /api/tecdoc/brands`, `PartBrandSummary`). Marka combobox deseni `part-form.tsx`'te mevcut.

## 3. Kararlar

| Konu | Karar |
|------|-------|
| Kategori cascade verisi | TecDoc araç-özel ağaç; araç TecDoc'ta eşleşmemişse (`catalogVehicleTypeId` yok) serbest metin kategoriye düş |
| Marka verisi | TecDoc parça markaları (`getPartBrands`) dropdown + listede yoksa serbest metin combobox |
| Saklama | `ServiceOrderItem`'a yeni nullable kolonlar: `brand`, `category`, `categoryId` |
| Inline kapsam | Mevcut satırlar düzenlenebilir; yeni `updateOrderItemAction` eklenir; ekleme akışı da inline kalır |

## 4. Şema değişikliği

`ServiceOrderItem` modeline 3 nullable kolon:

```prisma
brand      String?  // marka (bugün note'a giren tedarikçi/marka adı buraya taşınır)
category   String?  // seçilen yaprak kategori etiketi (örn. "Yağ filtresi")
categoryId Int?     // TecDoc kategori düğüm id'si (ileride filtre/rapor)
```

- Hepsi nullable → mevcut kayıtlar etkilenmez, veri kaybı yok.
- `note` serbest not olarak korunur (marka artık note'a karışmaz; yeni kayıtlarda marka `brand`'e yazılır, `note` opsiyonel not olur).
- Migration `prisma migrate dev` ile üretilir (committed baseline mimarisine uygun). Şema değişimi sonrası `db.ts` singleton nedeniyle **dev server restart** gerekir.
- Geriye dönük veri taşıma (note→brand) **yapılmaz** — eski satırlarda marka note'ta görünmeye devam eder; sadece yeni/düzenlenen satırlar `brand` kullanır. (YAGNI; istenirse ileride tek seferlik backfill.)

## 5. Server action: `updateOrderItemAction`

`src/app/(app)/orders/actions.ts` içinde, add/remove desenini birebir izler:

- İmza: `updateOrderItemAction(itemId: string, orderId: string, patch)` (FormData veya JSON — route ile tutarlı).
- Auth: `requireWritableWorkshop()` → `workshopId` sunucudan türetilir (client param'a güvenilmez — [[server-action-tenant-isolation]]).
- Sahiplik: item + order aynı workshop'a mı ait, `isOrderLocked(status)` ise 403 (kilitli iş emrinde düzenleme yok — [[work-order-editable-evidence-immutable]] parça satırı düzenlenebilir sınıfında).
- `patch` alanları: `quantity`, `unitPrice` (TRY→kuruş), `brand`, `category`, `categoryId`, opsiyonel `name`, `sku`, `unit`, `note`. Yalnızca gönderilen alanlar güncellenir (partial patch).
- Doğrulama: yeni `serviceOrderItemUpdateSchema` (Zod, `src/lib/validations/order.ts`) — tüm alanlar optional; quantity ≥ 1; unitPrice ≥ 0 kuruş int.
- **Stok mutabakatı (kritik):** satır `partId`'ye bağlı ve `quantity` değiştiyse, `$transaction` içinde `delta = yeniQty − eskiQty`:
  - `delta > 0` → `delta` kadar ek stok düş (`reserveStockInTx` mantığı, `StockMovement out`)
  - `delta < 0` → `|delta|` kadar iade (`returnStockInTx` mantığı, `StockMovement in`)
  - `partId` yoksa stok dokunulmaz.
- `recalcOrderPayment(orderId)` çağrılır (toplamlar/ödeme durumu güncellenir).
- `AuditLog` (orderId + metadata: hangi alan neyden neye) — [[order-activity-log-from-auditlog]].
- `revalidatePath` ilgili order yoluna.
- `/api/orders/items/route.ts`'e `PATCH` handler eklenir → `updateOrderItemAction`'a proxy.

## 6. `ItemRow` inline UX (mobil-öncelikli)

Satır iki satırlı; ikinci satır etkileşimli hale gelir:

- **1. satır:** Parça adı + SKU rozeti … (sağda) satır toplamı + çöp kutusu (mevcut).
- **2. satır (küçük ekranda wrap'lenen chip'ler):**
  - **Miktar stepper:** `[−] 1 [+]`. Her tık optimistik olarak local state'i günceller, **debounce'lu** (örn. 500ms) PATCH gönderir. `[−]` qty=1'de disabled.
  - **Fiyat:** görünen `₺60,00`'a tıklayınca inline `number` input olur; blur/Enter → PATCH, Esc → iptal.
  - **Marka ▾:** ShadcnUI/Base UI Combobox (TecDoc markaları + serbest yazım — [[base-ui-combobox-not-freeform]] uyarısı: Enter guard'ı gerekebilir; serbest yazım için gerekirse Autocomplete). Seçim/yazım → `brand` PATCH.
  - **Kategori ▾:** Popover içinde cascade. Araç TecDoc'ta eşleşmişse `CategoryNode` ağacında drill (Kategori→Alt kategori→yaprak) — ekran değişmeden, geri/ileri ile "next/next". Yaprak seçilince `category` + `categoryId` PATCH. Araç eşleşmemişse popover yerine serbest metin input → `category` PATCH (`categoryId` null).

Kilitli iş emrinde (`isOrderLocked`) tüm inline kontroller salt-görünüme döner (mevcut `onRemove` guard deseniyle tutarlı).

## 7. Yenileme stratejisi

- `window.location.reload()` **kaldırılır** (inline +/- de tam reload kabul edilemez).
- **Optimistik local state** + kaydolunca **`router.refresh()`** (soft, debounced). Fiyatlandırma kartı server-derived olduğu için `router.refresh()` toplamları tazeler, form/scroll state korunur.
- Server hata dönerse optimistik değişiklik geri alınır (rollback) ve `onError` ile hata gösterilir.

## 8. Ekleme akışı (`PartsLaborCard` add formu)

Add formuna da aynı alanlar girer: marka combobox + kategori cascade + stepper. `handleAdd` `FormData`'ya `brand`, `category`, `categoryId` ekler. TecDoc picker'dan seçimde `supplierName` artık `note` yerine `brand`'e yazılır (kategori de picker'ın kategori düğümünden gelebilir).

## 9. Dokunulan dosyalar

- `prisma/schema.prisma` + yeni migration
- `src/lib/validations/order.ts` — `serviceOrderItemUpdateSchema` (+ create şemasına brand/category/categoryId)
- `src/app/(app)/orders/actions.ts` — `updateOrderItemAction` (+ create action'a yeni alanlar)
- `src/app/api/orders/items/route.ts` — `PATCH`
- `src/components/app/order-management-panel.tsx` — `ItemRow` inline editörler, `PartsLaborCard` add formu, reload→router.refresh
- Yeni: `src/components/app/item-category-cascade.tsx` — cascade popover (TecDoc ağacı + serbest metin fallback)
- Marka combobox `part-form.tsx`'ten pay edilir veya ortak bileşene çıkarılır

## 10. Risk alanları

- **Stok mutabakatı** en riskli kısım — delta yanlışsa stok kayar. TDD ile korunmalı (qty artır/azalt, partId'li/partId'siz senaryolar).
- TecDoc cascade araç eşleşmesine bağlı — fallback serbest metin şart (kararlaştırıldı).
- Optimistik UI + rollback: server reddi (kilit/validasyon) sonrası UI tutarlılığı.
- Şema değişimi sonrası dev server restart unutulmamalı (`db.ts` singleton).
- Tenant izolasyonu her sorguda korunmalı ([[server-action-tenant-isolation]]).

## 11. Manuel QA adımları

1. Miktar +/- : toplam ve Fiyatlandırma kartı anında güncelleniyor mu; `partId`'li parçada stok doğru artıp azalıyor mu.
2. Fiyat inline düzenleme: kaydediyor, Esc iptal ediyor mu.
3. Marka dropdown: TecDoc listesi + serbest yazım, kayıt oluyor mu.
4. Kategori cascade: araç eşleşmiş araçta drill+seçim; eşleşmemiş araçta serbest metin fallback.
5. Kilitli (teslim/iptal) iş emrinde tüm inline kontroller salt-görünüm.
6. Optimistik rollback: kilitli order'a PATCH denemesi UI'ı geri alıyor mu.
7. Mobilde chip'lerin wrap davranışı, dokunma hedef boyutları.
