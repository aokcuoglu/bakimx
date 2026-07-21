# Tedarikçi Fiyat Karşılaştırma (mock) — Tasarım

**Tarih:** 2026-07-21
**Branch:** `feat/supplier-price-compare` (worktree, base `main`)
**Durum:** Onaylandı (tasarım)

## Amaç

İş emri "Kullanılan Parçalar & İşçilikler" grid'inde, bir parça satırından
o parçanın **birden fazla tedarikçideki fiyatlarını** karşılaştırmalı gösteren
bir popup açmak. Şimdilik **mock (örnek) veri** — lansman/satış demolarında
müşteriye "tedarikçi fiyat karşılaştırması" özelliğini göstermek için. İleride
gerçek tedarikçi API'sine tek dosya değişikliğiyle bağlanabilecek şekilde
izole bir veri katmanı.

## Kapsam kararları (onaylı)

- **İkon kapsamı:** Yalnızca `type === "part"` satırda **ve** satırda bir parça
  adı (`name.trim()`) varken görünür. Boş satırda / işçilik satırında yok.
- **Fiyat aksiyonu:** Bir tedarikçinin fiyatına tıklanınca ("Bu fiyatı kullan")
  fiyat satırın **Birim Fiyat** alanına yazılır (`onCell` → `liraToKurus`).
- **Karşılaştırma alanları:** Fiyat (₺) + "En uygun" rozeti, stok durumu,
  teslimat süresi, sunulan marka (OEM/muadil) + tedarikçi parça no'su.

## Mimari

Üç birim, net sınırlarla:

### 1. `src/lib/tecdoc/mock-supplier-prices.ts` (yeni, saf)

```ts
export type SupplierStock = "in_stock" | "low_stock" | "orderable"
export type SupplierOffer = {
  supplierName: string
  brandName: string          // sunulan marka (OEM/muadil)
  brandKind: "oem" | "aftermarket"
  articleNo: string          // tedarikçinin parça no'su
  priceKurus: number         // birim fiyat, kuruş (money.ts kontratı)
  stock: SupplierStock
  stockQty?: number          // low_stock için "son N adet"
  deliveryLabel: string      // "Bugün kargo" / "1-2 iş günü" ...
}
export type SupplierPriceResult = {
  offers: SupplierOffer[]    // fiyata göre ARTAN sıralı
  cheapestIndex: number      // offers[0] (sıralı olduğu için 0)
  isMock: true
}
export function getMockSupplierPrices(part: {
  sku?: string | null; name: string; brand?: string | null
}): SupplierPriceResult
```

- **Deterministik:** `Math.random`/`Date.now` YOK. Fiyat/stok/teslimat, `sku`
  (yoksa `name`) üzerinden basit bir string hash'ten türetilir → aynı parça
  her zaman aynı sonucu verir (demo tutarlılığı + `Math.random` kısıtı).
- 4-5 sabit tedarikçi adı (gerçekçi TR oto yedek parça dağıtıcı/pazar isimleri).
- Fiyatlar kuruş; `money.ts` kontratına uyar. Sonuç fiyata göre artan sıralı.

### 2. `src/components/app/supplier-price-dialog.tsx` (yeni, client)

- shadcn `Dialog` (Base UI) — kontrollü (`open`/`onOpenChange`, trigger dışarıda).
- Props: `open`, `onOpenChange`, `part: { name; sku; brand }`, `editable`,
  `onApply: (priceKurus: number) => void`.
- İçerik: başlıkta parça adı + parça no. Gövdede tedarikçi kartları (artan sıralı):
  tedarikçi adı, marka rozeti (OEM/muadil), tedarikçi parça no, fiyat (`formatTRY`),
  stok göstergesi, teslimat etiketi, **"Bu fiyatı kullan"** butonu (`editable` ise).
  En ucuz karta yeşil "En uygun" rozeti.
- Alt köşede dürüstlük etiketi: **"Örnek fiyatlar — demo"** (canlı entegrasyon
  izlenimi vermemek için; landing honesty kuralları ruhuna uygun).
- "Bu fiyatı kullan" → `onApply(priceKurus)` + dialog kapanır.

### 3. `src/components/app/parts-labor-grid.tsx` (düzenle)

- `PartField` içine (arama kutusunun yanına) küçük bir **trigger** ekle:
  `ed.isPart && row.name.trim()` iken görünen `Tags` ikonlu ghost buton.
- Kendi `open` state'ini tutan küçük bir alt bileşen (`PartPriceCompare`) trigger
  + dialog'u sarar; `onApply` = `onCell(row, { unitPrice })`. `PartField` zaten
  `onCell` alıyor. Tek yerde tanımlı → masaüstü `<tr>` ve mobil kart otomatik alır.
- Kilitli emirde (`!ed.editable`) trigger görünür ama dialog `editable={false}`
  (salt-görüntüleme, "Bu fiyatı kullan" yok).

## Değişmeyecekler

- Şema / migration **yok**.
- API route **yok** (mock tamamen client-side saf fonksiyon).
- Persist edilen alanlar değişmez; yalnız mevcut `unitPrice` yolu kullanılır.
- Tenant/izolasyon etkilenmez (sunucuya yeni veri gitmez).

## Test

- `mock-supplier-prices.ts` için birim testi: (1) determinizm (aynı girdi → aynı
  çıktı), (2) `offers` fiyata göre artan sıralı, (3) `cheapestIndex === 0`,
  (4) farklı parça no → farklı sonuç (hash dağılımı), (5) tüm fiyatlar > 0 tamsayı kuruş.

## Manuel QA

1. Bir iş emrinde parça satırına parça seç → arama kutusu yanında `Tags` ikonu belirir.
2. İkona bas → popup açılır, tedarikçiler fiyata göre sıralı, en ucuzda "En uygun".
3. "Bu fiyatı kullan" → popup kapanır, satırın Birim Fiyat'ı o değere döner, Toplam güncellenir.
4. İşçilik satırında / boş parça satırında ikon görünmez.
5. Kilitli (teslim/iptal) emirde ikon var ama "Bu fiyatı kullan" yok.
6. Mobil: kartta da ikon çalışır, popup okunur.
```
