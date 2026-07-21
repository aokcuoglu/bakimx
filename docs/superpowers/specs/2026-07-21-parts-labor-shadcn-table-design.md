# Parça/İşçilik Grid → shadcn Base `<table>` restyle

**Tarih:** 2026-07-21
**Kapsam:** `src/components/app/parts-labor-grid.tsx` sunum katmanı yeniden düzenlemesi.
**Değişmeyen:** API, şema, veri akışı, otomatik-kaydetme mantığı — hiçbiri.

## Problem

İş emri "Kullanılan Parçalar & İşçilikler" tablosu `<div>`'lerden kurulu bir CSS
grid (`grid-cols-[...]`). Sorunlar:

1. Sil ikonu, grid'in `px-2` padding'i + kolon toplamı `min-w`'yi aştığında son
   kolonu `bg-muted` satırının dışına taşıyor (beyaz alanda kalıyor).
2. Kolon genişlikleri kırılgan (min-w el hesabı); içerik değişince yeniden bozuluyor.
3. Kullanıcı, projenin `base-nova` + `neutral` (New York, ince, monokrom) tablo
   görünümünü istiyor — mevcut yapı gerçek bir `<table>` değil.

Karar (kullanıcı onaylı): TanStack Data Table **değil**; var olan satır-içi
düzenleme + otomatik-kaydetme mantığı korunarak gerçek shadcn Base `<table>`'a
restyle. 1–10 satırlık bu liste için sıralama/sayfalama gereksiz.

## Tasarım

### 1. İki ayrı ağaç (repodaki `order-list.tsx` deseni)

- **Masaüstü (md+):** `hidden md:block` sarmalayıcı içinde gerçek `<table>`
  (`<thead>/<tbody>/<th>/<td>`). `overflow-x-auto` + tabloya `min-w`.
  Kolon genişlikleri `table-fixed` + `<colgroup>`; Parça kolonu kalan alanı alır.
  Sil butonu kendi `<td>`'sinde → satır-dışı taşma **yapısal olarak** biter.
- **Mobil (<md):** `md:hidden` — mevcut kart düzeni korunur (mobil-first; `<table>`
  mobilde kötü UX).

Bir `<table>` içinde `<td>` + mobil kartı responsive class ile karıştırmak kirli
olurdu; iki ağaç repoda zaten kullanılan temiz desendir. Maliyet: satır başına
editör örnekleri 2× mount olur (biri CSS ile gizli). Combobox/arama yalnız
`linked && editable` part satırında mount olur ve fetch'ler cache'li (kotasız) →
kabul edilebilir, önemsiz.

### 2. Paylaşılan mantık `useRowEditor` hook'unda

Satır-yerel state + işleyiciler tek hook'ta toplanır ve iki görünüm tüketir:
`editingPrice`, `priceDraft`, `tecdocOpen`, `filter` state; `fillFromArticle`,
`startPrice`/`commitPrice`, `lineTotal`, `linked`, `isPart`. Böylece
`DesktopPartRow` (`<tr>` döner) ve `MobilePartRow` (kart döner) tek gerçeğe bağlı;
davranış birebir korunur, kod tekrarı olmaz.

`PartsLaborGrid`'in üst-seviye state'i (rows, persistDraft, persistUpdate,
addDraft, clearRow, removeRow, onCell, saveTimers, rowsRef) **aynen kalır** — yalnız
`GridRow` çağrısı iki ağaca bölünür.

### 3. `src/components/ui/table.tsx` (yeni)

shadcn Base (`base-nova`) table primitive'leri: `Table, TableHeader, TableBody,
TableRow, TableHead, TableCell`. `npx shadcn add table` ile; gerekirse elle
`base-nova` stiline uydurulur.

### 4. New York / monokrom görünüm

Çevreleyen ince `border` + `rounded-lg`, `bg-muted` başlık, satırlar arası
`border-b` ayraç (satır-başı muted "hap" görünümü kalkar), `text-sm`, `neutral`
token'lar. Zaten temadan (`base-nova` + `neutral`) geliyor.

### 5. Korunan davranış (regresyon kontrol listesi)

POST/PATCH/DELETE otomatik-kaydetme, catch-up PATCH, `__draft`/`__saving`,
Marka/Kategori combobox filtreleri, parça autocomplete + SKU çipi, miktar stepper,
satır-içi fiyat düzenleme, TecDoc modal, temizle (`onClear`) / sil (`onRemove`),
kilitli-emir (`locked`) salt-görünür durumu, "Yeni satır", boş-liste mesajı.

## Değişecek dosyalar

- `src/components/ui/table.tsx` — yeni (shadcn Base table primitive'leri).
- `src/components/app/use-row-editor.ts` — yeni (paylaşılan satır-editör hook'u).
- `src/components/app/parts-labor-grid.tsx` — yeniden düzenleme (masaüstü `<table>`
  + mobil kart, `GridRow` → `DesktopPartRow` + `MobilePartRow`).

## Riskler

- Hook çıkarımında bir editör prop/callback bağlantısını kaçırmamak.
- `table-fixed`'te editörlerin `w-full` ile hücreye oturması (taşma/kırpma yok).
- Mobil kartın bozulmaması.
- İki-ağaç doubling'i (kabul edilir, yukarıda).

## Doğrulama

lint + typecheck; canlı görsel QA: masaüstü tablo hizası + sil ikonu satır-içi,
uzun ad/kategori okunur, dar ekran yatay kaydırma, mobil kart bozulmamış,
parça seç/temizle/sil + otomatik-kaydetme + fiyat + miktar + TecDoc modal çalışır.
