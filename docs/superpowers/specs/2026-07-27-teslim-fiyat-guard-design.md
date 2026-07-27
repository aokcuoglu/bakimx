# Fiyatsız kalem varken araç teslimini engelle

Tarih: 2026-07-27
Dal: `feat/delivery-price-guard` (base: `dev`)

## Problem

İş emrinde fiyatı hiç girilmemiş kalemler (`unitPrice = null`, arayüzde `—`) varken araç
müşteriye teslim edilebiliyor. Teslimden sonra iş emri kilitleniyor (`isOrderLocked`), yani
fiyat bir daha girilemiyor: tutar kalıcı olarak eksik kalıyor, tahsilat ve müşteri bakiyesi
yanlış hesaplanıyor.

## Kural

Bir kalem **fiyatsız** sayılır: `unitPrice === null`.

- `0` geçerli bir fiyattır (bedelsiz/garanti kalemi) — engellemez.
- Kalem tipi ayrımı yok: `part`, `labor`, `external_labor` aynı şekilde sayılır.
- Kalemi olmayan iş emri: eksik yok, teslim serbest.

Fiyatsız kalem varken iş emri `delivered` durumuna geçemez.

## Kapsam

- **Engel yalnız teslim adımında.** `ready_for_delivery`'ye geçiş serbest kalır; usta işi
  bitirip emri teslimata hazır işaretleyebilir, fiyatlar teslim anına kadar girilebilir.
- Teklif (quote) akışı ve teknisyen ekranı kapsam dışı (teknisyen zaten teslim yapamıyor,
  yalnız `ready_for_delivery`'ye taşıyor).
- Şema değişikliği yok, migration yok.

## Tasarım

### 1. Kural — tek kaynak

Yeni modül `src/lib/orders/pricing-guard.ts` (yanındaki `header-actions.ts` ile aynı desen):

```ts
export type PriceableItem = { id: string; name: string; unitPrice: number | null }

/** Fiyatı hiç girilmemiş kalemler. unitPrice === null → eksik; 0 geçerli fiyattır. */
export function findUnpricedItems<T extends PriceableItem>(items: readonly T[]): T[]

/** Sunucu hata metni: "Fiyatı girilmemiş kalemler var: A, B (+1). ..." */
export function unpricedItemsMessage(items: readonly PriceableItem[]): string
```

Sunucu ve arayüz aynı fonksiyonu kullanır; kural iki yerde ayrı yazılmaz.

### 2. Sunucu tarafı — asıl engel

Üç nokta, hepsi `findUnpricedItems` üzerinden:

| Nokta | Dosya | Davranış |
| --- | --- | --- |
| OTP kodu isteme | `src/app/(app)/intakes/delivery-actions.ts` → `requestDeliveryOtpAction` | Eksik varsa `{ error }`; **SMS hiç gitmez** |
| OTP doğrulama | aynı dosya → `verifyDeliveryOtpAction` | Aynı kontrol tekrar (kod istendikten sonra fiyat silinirse) |
| Durum geçişi | `src/app/(app)/orders/actions.ts` → `updateOrderStatusAction` | `status === "delivered"` ise `canTransitionOrder`'dan sonra guard |

Hata metni:

> Fiyatı girilmemiş kalemler var: Hava filtresi, Silecek süpürgesi (+1). Teslim öncesi tüm
> kalemlere fiyat girin (0 TL girilebilir).

### 3. Plan yazma-kilidi muafiyeti

`delivery-actions.ts:24-27`'deki ürün kararı korunur: abonelik süresi dolmuş (salt-okunur)
dükkân, içerideki aracı OTP ile teslim edebilmeli — araç ödeme duvarına rehin kalmasın. O
dükkân kalem düzenleyemediği için fiyat da giremez, dolayısıyla:

**`getPlanState(workshop).canWrite === false` ise fiyat guard'ı uygulanmaz.**

Normal (yazabilen) dükkânlarda kural tam sert. Muafiyet yalnız iki OTP aksiyonunda geçerlidir;
`updateOrderStatusAction` zaten `requireWritableWorkshop` ile korunuyor, oraya ek muafiyet
gerekmez.

### 4. Arayüz

- `DetailHeaderAction` tipine `disabled?: boolean` eklenir. `src/components/orders/detail-header.tsx`
  bunu birincil butonda ve `⋯` taşma menüsü öğesinde uygular. Başlığa yeni buton eklenmez,
  üç katman düzeni korunur.
- `src/components/orders/work-order-detail.tsx`: `order.items` zaten prop'ta;
  `findUnpricedItems` ile hesaplanır, `delivered` aksiyonu pasifleşir.
- Mevcut `{error && ...}` bloğunun hemen altına, yalnız `order.status === "ready_for_delivery"`
  ve eksik varken uyarı şeridi:

```
⚠ 3 kalemin fiyatı girilmemiş.
  Hava filtresi, Silecek süpürgesi, +1
  [ Parça sekmesinde tamamla ]   → handleTabChange("parca")
```

İlk 2 isim + `+N` (mobil için kısa). Parça & İşçilik grid'inde fiyatsız satır zaten gri `—`
gösteriyor; oraya ek işaretleme yapılmaz.

## Test

`src/lib/orders/pricing-guard.test.ts`:

- `unitPrice = null` → eksik listesinde
- `unitPrice = 0` → eksik değil
- boş kalem listesi → eksik yok
- karışık liste → yalnız `null` olanlar, sırayı koruyarak
- `unpricedItemsMessage` → 2 isim + `(+N)` biçimi

## Riskler

- Halihazırda `ready_for_delivery`'de bekleyen ve fiyatsız kalemi olan iş emirleri teslim
  edilemez hale gelir. Fiyat girilince açılır — istenen davranış, ama sürüm notunda belirtilmeli.
- OTP kodu istenip fiyat sonradan silinirse doğrulama reddeder; kullanıcı fiyatı girip yeni kod
  ister. Kabul edilen davranış.
- `verifyDeliveryOtpAction` içindeki order senkronu `updateOrderStatusAction`'ı çağırıyor;
  verify guard'ı geçtiyse oradaki guard da aynı veriyle geçer (çift kontrol, çelişki yok).

## Manuel QA

1. Fiyatsız kalemli iş emrini `ready_for_delivery` yap → başlıkta "Teslim Et (OTP)" pasif,
   altında uyarı şeridi; "Parça sekmesinde tamamla" doğru sekmeye götürüyor.
2. Tüm kalemlere fiyat gir (birine `0`) → uyarı kaybolur, buton aktif, OTP akışı çalışır.
3. Fiyatsızken `/api/intakes/<id>/delivery-otp` doğrudan POST → 400 + hata metni, SMS gitmez.
4. Kalemsiz iş emri → teslim engellenmez.
