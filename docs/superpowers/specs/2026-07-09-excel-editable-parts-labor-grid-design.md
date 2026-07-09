# Excel-Benzeri Düzenlenebilir Parça/İşçilik Tablosu — Tasarım

**Tarih:** 2026-07-09
**Durum:** Onaylandı (implementasyon bekliyor)
**Kapsam:** İş emri detayı → "Parça & İşçilik" sekmesi → `PartsLaborCard` yeniden tasarımı

## 1. Amaç

Kullanıcı, kullanılan parça/işçilik kalemlerini **Excel-benzeri düzenlenebilir bir tabloda** yönetsin:

- "Yeni satır" ile satır ekle, çöp kutusuyla satır sil.
- Her satırda **tür** seç (Yedek Parça / İşçilik / Dış İşçilik).
- Parça satırında **büyüteç 🔍** → TecDoc modalı açılır; kategori → (marka filtreli) parça seçilir.
- Fiyatı manuel gir, miktarı artır/azalt.
- Marka ve kategori düzenlenebilir (parça satırlarında).

Bu tasarım, 2026-07-08'de eklenen inline satır düzenlemenin (ayrı ekleme formu + `ItemRow`) yerini alır; oradaki inline kontroller (stepper/fiyat/marka combobox/kategori cascade) ve sunucu altyapısı (`updateOrderItemAction` + CAS stok, `addOrderItemAction`, `computeStockDelta`, PATCH/POST route) **korunur ve tabloya yeniden dizilir**.

## 2. Mevcut durum

- Render: `src/components/app/order-management-panel.tsx` → `PartsLaborCard` + `ItemRow` (inline editörlü) + ayrı "Yeni Parça/İşçilik" formu.
- Model: `ServiceOrderItem` (`type: OrderItemType`, `name, sku, unit, quantity, unitPrice, totalPrice, partId, tecdocArticleId, note, brand, category, categoryId`). Enum `OrderItemType = part | labor` (schema.prisma:773).
- TecDoc picker: `src/components/app/tecdoc-part-picker.tsx` — sağdan açılan **Sheet**; kategori drill (`CategoryNode`) → parça listesi (`/api/tecdoc/articles?vehicleId=&categoryId=`, client-side metin filtresi). `onSelect` döner: `{ name, articleNo, tecdocArticleId, supplierName }`. Kategori bilgisi dönmüyor.
- Mutasyonlar: `addOrderItemAction` (POST), `removeOrderItemAction` (DELETE), `updateOrderItemAction` (PATCH, kısmi patch + CAS stok mutabakatı) — `src/app/(app)/orders/actions.ts`, `/api/orders/items` route.
- Totaller: `src/lib/totals.ts` — `partsTotal`/`laborTotal` type'a göre; `recalcOrderPayment` bunları kullanır.
- Yeniden kullanılabilir bileşenler: `PartBrandCombobox`, `ItemCategoryCascade`.

## 3. Kararlar

| Konu | Karar |
|------|-------|
| Satır türleri | `OrderItemType` enum'una `external_labor` eklenir (part \| labor \| external_labor). Dış işçilik = işçilik gibi; tedarikçi/maliyet alanı YOK (YAGNI) |
| Kaydetme modeli | Taslak satır (client-side) → zorunlu alan (ad) dolunca otomatik POST → sonra inline PATCH |
| TecDoc modalı | Kategori → Parça (marka/supplier filtreli); mevcut Sheet **Dialog modal**'a çevrilir; kategori de yakalanır |
| Kapsam | Tek birleşik düzenlenebilir tablo; ayrı ekleme formu + eski `ItemRow` kalkar |
| Mobil | Masaüstü (md+) grid; mobil her satır bir kart (dikey yığılı, aynı inline kontroller) |
| Ekleme akışı | Tek "+ Yeni satır" (varsayılan tür=Yedek Parça); ilk hücrede tür dropdown'u |
| Tür değişimi | Taslak iken serbest; **kaydedildikten sonra kilitli** (part↔labor stok/karmaşıklık) — değiştirmek için sil+yeniden ekle |

## 4. Şema değişikliği

`OrderItemType` enum'una değer eklenir:

```prisma
enum OrderItemType {
  part
  labor
  external_labor
}
```

- Postgres `ALTER TYPE "OrderItemType" ADD VALUE 'external_labor'` — additive, mevcut satırlar etkilenmez. Prisma `migrate dev` üretir; `ADD VALUE` transaction dışı çalışabilir (Prisma yönetir). Deploy'da auto-migrate ile prod'a gider.
- `external_labor` semantiği: `labor` gibi — stok yok (partId hiç set edilmez), SKU/marka/kategori zorunlu değil (UI'da pasif). Birim varsayılan "adet" (istenirse "saat").
- Şema sonrası `db.ts` singleton nedeniyle **dev server restart**.

## 5. Tek birleşik düzenlenebilir tablo (`PartsLaborGrid`)

Yeni dosya `src/components/app/parts-labor-grid.tsx` (panel dosyası şişmesin). `PartsLaborCard` bunu render eder; eski `ItemRow` + ekleme formu silinir.

**Masaüstü (md+) sütunları:** `Tür ▾ | Parça/Ad 🔍 | Marka | Kategori | Miktar −N+ | Birim | Birim Fiyat | Toplam | 🗑`
**Mobil:** her satır bir kart; alanlar dikey yığılı, aynı kontroller, `overflow-x` yok (kart içi wrap).

Satır bileşeni (`GridRow`) tür'e göre koşullu hücreler:
- **Tür** hücresi: `Yedek Parça / İşçilik / Dış İşçilik` dropdown (Base UI Select). Taslak iken aktif; kalıcıda salt-görüntü.
- **Parça/Ad:** `part` → serbest ad input + büyüteç 🔍 (TecDoc modalı); `labor/external_labor` → sadece ad input (🔍 yok).
- **Marka / Kategori / SKU:** yalnız `part` satırlarında aktif (`PartBrandCombobox` / `ItemCategoryCascade`); diğer türlerde gizli/pasif.
- **Miktar:** stepper `−N+` (mevcut). **Birim:** input. **Birim Fiyat:** tıkla-düzenle (mevcut). **Toplam:** hesaplanan (readonly). **🗑:** sil.
- Kilitli iş emrinde (`isOrderLocked`) tüm hücreler salt-görüntü (mevcut guard deseni).

## 6. Taslak satır + otomatik kaydet akışı

`PartsLaborGrid` local `rows` state'i tutar: kalıcı kalemler (gerçek `id`) + taslak satırlar (`tempId`, `__draft: true`).

- **"+ Yeni satır"** → `rows`'a taslak satır ekler (`tempId = "draft-" + counter`, tür=`part`, boş alanlar). Sunucu çağrısı yok.
- Taslak satır hücre düzenleme → yalnız local `rows`.
- **Otomatik kaydet tetikleyici:** taslak satırın `name` alanı boş-değil olunca (blur veya ~800ms debounce). `addOrderItemAction` (POST FormData: type, name, sku, unit, quantity, unitPrice, note, brand, category, categoryId, tecdocArticleId, partId) çağrılır.
  - Çift-kaydet koruması: satırda `saving` bayrağı; kaydolurken tekrar tetiklenmez. Kayıt sırasında `tempId` → dönen gerçek `id`; `__draft` kalkar.
- Kalıcı satır hücre düzenleme → `updateOrderItemAction` (PATCH, debounce'lu — mevcut `updateItem` altyapısı, alan-bazlı debounce anahtarı).
- **Sil:** taslak → `rows`'tan çıkar (sunucu yok); kalıcı → `removeOrderItemAction` (DELETE) + `router.refresh()`.
- **`router.refresh()`** kalıcı yazımlardan sonra (toplamları/Fiyatlandırma kartını tazeler). Optimistik `rows`, `items` prop'undan `useEffect` ile senkron (mevcut desen).
- Sunucu hatası → optimistik geri-alma + `onError`.

## 7. TecDoc modalı (Kategori → Parça, marka filtreli)

`src/components/app/tecdoc-part-picker.tsx` Sheet → **Dialog** (`@/components/ui/dialog`) modal'a çevrilir (veya modal varyantı eklenir).

- Akış: kategori cascade (mevcut drill) → seçilen kategorinin parça listesi.
- Parça listesi üstünde: **marka (supplier) filtresi** (dropdown/chips; `articles`'ın `supplierName`/`supplierId` alanlarından türetilir — TecDoc API'sine ek param YOK, client-side filtre) + mevcut metin arama.
- **`onSelect` genişler:** `{ name, articleNo, tecdocArticleId, supplierName, categoryName, categoryId }` — drill edilen yaprak kategori düğümü (`node.name` + `node.id`) yakalanıp döner.
- Satır dolar: `name=productName`, `sku=articleNo`, `brand=supplierName`, `category=categoryName`, `categoryId`, `tecdocArticleId`.
- 🔍 yalnız `part` satırında; araç TecDoc'ta eşleşmemişse (catalogVehicleTypeId yok) 🔍 pasif + ipucu (serbest ad yazılır).

## 8. Fiyatlandırma özeti

- `src/lib/totals.ts`: `external_labor` tanınır; yeni toplam `externalLaborTotal` (veya laborTotal'a dahil — **karar: ayrı satır**). `Totals` tipine `externalLaborTotal` + sayaç eklenir; grand total tüm türleri kapsar (mevcut mantık zaten hasPrice/lineTotal üzerinden; type-bazlı ayrım yalnız özet kırılımı için).
- `PricingSummaryCard` (order-management-panel.tsx): "Parça Toplamı / İşçilik Toplamı / **Dış İşçilik Toplamı**" satırları. Değeri 0/yoksa "—".

## 9. Doğrulama & sunucu

- `src/lib/validations/order.ts`: `serviceOrderItemSchema.type` ve create/update tip kabulü `external_labor` içerir (`z.enum(["part","labor","external_labor"])`).
- `src/app/(app)/orders/actions.ts`: `addOrderItemAction`/`updateOrderItemAction` `external_labor`'ı kabul eder; stok mantığı yalnız `type === "part"` + `partId` için çalıştığından `external_labor` doğal olarak stok tutmaz (değişiklik minimal).
- Tenant izolasyonu, kilit guard'ı, kuruş para birimi — mevcut invaryantlar korunur.

## 10. Dokunulan dosyalar

- `prisma/schema.prisma` + enum migration
- `src/lib/totals.ts` (externalLaborTotal)
- `src/lib/validations/order.ts` (enum external_labor)
- `src/app/(app)/orders/actions.ts` (external_labor kabul)
- `src/components/app/order-management-panel.tsx` (`PartsLaborCard` → grid render + `PricingSummaryCard` +Dış İşçilik satırı; eski `ItemRow` + ekleme formu silinir)
- Yeni: `src/components/app/parts-labor-grid.tsx` (grid + `GridRow`)
- `src/components/app/tecdoc-part-picker.tsx` (Sheet→Dialog + marka filtresi + kategori yakalama; `onSelect` genişler)
- Yeniden kullanılan (değişmeden): `PartBrandCombobox`, `ItemCategoryCascade`, `computeStockDelta`, `/api/orders/items` route

## 11. Risk alanları

- **Taslak→kalıcı id geçişi**: optimistik state + çift-kaydet önleme (`saving` bayrağı) en riskli UI parçası; yanlışsa mükerrer kalem veya kayıp düzenleme.
- **Enum migration (ADD VALUE)**: additive ama geri alınamaz; deploy auto-migrate ile prod'a gider — `migrate deploy` güvenli.
- **TecDoc onSelect genişlemesi**: mevcut tek tüketici (add form) kalkıyor; yeni tüketici grid. Kategori yakalama drill state'inden alınır.
- **Marka filtresi client-side**: büyük kategorilerde (100+ parça, `MAX_VISIBLE_ARTICLES`) filtre görünen kümede çalışır.
- **Tür değişimi kilidi**: kaydedilmiş satırda tür değiştirilemez — kullanıcıya net ipucu; aksi halde kafa karışıklığı.
- Masaüstünde geniş tablo — mobil kart moduyla dengelenir; sütun sayısı fazla (marka/kategori part-only).

## 12. Manuel QA adımları

1. "+ Yeni satır" → boş taslak; ad yazınca otomatik kaydolur (kalem sayısı artar, Fiyatlandırma güncellenir).
2. Tür dropdown: Yedek Parça/İşçilik/Dış İşçilik; part'ta 🔍+marka+kategori aktif, diğerlerinde pasif.
3. 🔍 → TecDoc modal: kategori → marka filtresi → parça seç; satır ad/SKU/marka/kategori ile dolar.
4. Miktar stepper + fiyat inline: partId'li parçada stok doğru; toplam ve özet anında güncellenir.
5. Dış İşçilik: stok tutmaz; Fiyatlandırma'da "Dış İşçilik Toplamı" görünür.
6. Sil: taslak satır sunucusuz gider; kalıcı satır DB'den silinir (partId'li ise stok iade).
7. Kaydedilmiş satırda tür kilitli (salt-görüntü + ipucu).
8. Kilitli (teslim/iptal) iş emri: tüm tablo salt-görüntü.
9. Mobil: satırlar kart olarak; düzenleme çalışır, yatay taşma yok.
10. Çift-tık/çift-gönderim: taslak iki kez kaydolmaz (saving guard); miktar CAS guard'ı korur.
