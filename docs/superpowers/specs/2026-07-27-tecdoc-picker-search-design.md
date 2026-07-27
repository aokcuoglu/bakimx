# "Araca Uygun Parçalar" modalında birleşik arama — tasarım

Tarih: 2026-07-27
Dal: `feat/tecdoc-picker-search` (base: `dev`)

## Problem

`TecdocPartPicker` ("Araca Uygun Parçalar" modalı) yalnızca kategori → alt kategori →
parça drill-down'u sunuyor. Arama kutusu **yalnızca yaprak kategoriye girildikten
sonra** çıkıyor ve yalnız o kategorinin yüklü listesini süzüyor.

Sonuç: kullanıcı ne aradığı parçanın hangi kategoride olduğunu bilmiyorsa 15+
kategorilik listede el yordamıyla dolaşmak zorunda. Kategori, alt kategori, ürün
ve marka adları üzerinden arama yapılamıyor.

## Hedef

Modalın her seviyesinden; kategori, alt kategori, parça adı/numarası ve marka
adıyla arama yapılabilmesi. En azından **DB'de cache'li** parçalar üzerinden
ürüne ve markaya kadar inilebilmesi.

## Mevcut altyapı (yeniden kullanılacak)

- `GET /api/tecdoc/articles/search?vehicleId&q&supplierId&categoryId`
  (`searchVehicleArticles`, PR #101): araç kapsamlı, **DB-only ve kotasız**;
  parça no + ad + **marka adı** + **kategori adında** eşleşir, boşlukla ayrılan
  terimler AND'lenir, Türkçe harf katlaması yapar (`normalizePartSearchTerm`).
  Bugün yalnızca `part-search-input.tsx` (iş emri parça satırı) kullanıyor.
- Kategori ağacı client'ta zaten yüklü (`CategoryNode[]`), `flattenCategoryLeaves`
  yol (`path`) üretiyor.
- `trIncludes` / `partSearchIncludes` / `normalizePartSearchTerm` (`lib/tr-search`).

Yani yeni sağlayıcı isteği, yeni endpoint ve şema değişikliği **gerekmiyor**.

## Bilinen kısıt — dürüstlük notu

Parça araması DB-only: yalnızca daha önce görüntülenmiş veya prefetch edilmiş
kategorilerin parçalarını bulur (sağlayıcıda numara/ad arama ucu yok). Bu boşluğu
kapatmak için:

1. Kategori eşleşmeleri **her zaman** gösterilir → kullanıcı oradan kategoriye
   girip veriyi çektirebilir.
2. Sonuç boşken açık bir bilgi notu gösterilir: arama kataloğa daha önce çekilmiş
   parçalarda yapılır, kategoriden ilerlenerek yenileri getirilebilir.

## Tasarım

### Arama modu

Başlığın altında, **her seviyede** görünen tek arama kutusu (sticky).

| Durum | Davranış |
|---|---|
| Sorgu boş | Bugünkü davranış birebir: kategori ağacı ya da kategori parça listesi |
| Kök/ara seviye + 2+ harf | **Global sonuçlar**: `KATEGORİLER` + `PARÇALAR` |
| Kategori içinde (parça listesi yüklü) | Bugünkü client-side filtre (ekstra istek yok) + kaldırılabilir kapsam çipi |

- **Kapsam çipi**: kategori içinde arama yapılırken input altında
  `Fren tertibatı içinde ×`. `×` → sorgu korunarak global aramaya geçilir
  (`articles`/`stack` sıfırlanır, ağaç gerekiyorsa tembel yüklenir).
- **Kategori sonucu satırı**: ad + altında yol ("Fren tertibatı / Fren balatası").
  Tıklanınca: dalı varsa `stack`'e itilir, yaprak ise `openLeaf`. Her iki durumda
  sorgu temizlenir → normal drill-down akışına dönülür.
- **Parça sonucu satırı**: mevcut satır görünümü (görsel, ad, `articleNo · marka`)
  + üçüncü satırda kategori adı (bağlam) + `ⓘ` detay butonu (varsa).
  Seçilince `onSelect` sonucun **kendi** `categoryId`/`categoryName`'i ile çağrılır
  (drill-down'daki gibi `stack`'in son elemanı değil).
- **Marka çipleri**: sonuç kümesinden türetilir (`BOSCH 12`, `FEBI 4`), seçim
  yalnızca client-side daraltır. API çağrısı markaya göre filtrelenmez (yoksa
  çipler kendi kendini yok ederdi). Modal açılışında `initialSupplierName`
  varsa ve sonuçlarda geçiyorsa o çip ön-seçili gelir.
- **Debounce**: 300 ms (mevcut `part-search-input` kalıbı). Kategori eşleşmesi
  client-side olduğu için anında güncellenir.
- **Yarış koşulu**: her fetch'te `active` bayrağı + `AbortController` yerine
  mevcut kalıp (`let active = true`, cleanup'ta `false`) kullanılır.

### Kod yapısı

`tecdoc-part-picker.tsx` bugün 516 satır; arama eklenince 700+ olurdu. Hedefli
ayrıştırma:

| Dosya | Rol |
|---|---|
| `components/parts/tecdoc-part-picker.tsx` | Modal kabuğu, durum yönetimi, drill-down, arama modu geçişleri |
| `components/parts/tecdoc-article-row.tsx` *(yeni)* | Tek parça satırı — drill-down listesi ve arama sonuçları ortak kullanır |
| `components/parts/tecdoc-search-results.tsx` *(yeni)* | Kategori bölümü + marka çipleri + parça bölümü + boş durum |
| `components/parts/vin-link-prompt.tsx` *(yeni)* | `VinLinkPrompt` taşınır (picker ile ilgisiz ~120 satır) |
| `lib/tecdoc/tree.ts` | `searchCategoryTree(nodes, query, limit)` |
| `app/api/tecdoc/articles/search/route.ts` | Opsiyonel `limit` (server'da 1–50 clamp) |

### `searchCategoryTree`

```ts
export interface CategoryMatch {
  id: number
  name: string
  /** Üst kategori yolu (" / " ayraçlı, düğümün kendi adı hariç). Kökte "". */
  path: string
  hasChildren: boolean
}
export function searchCategoryTree(
  nodes: CategoryNode[],
  query: string,
  limit?: number,
): CategoryMatch[]
```

- Ağacın **tüm** düğümleri (yalnız yapraklar değil) taranır — kullanıcı üst
  kategori adını da yazabilir.
- Eşleşme: sorgu boşlukla terimlere ayrılır, her terim düğümün **kendi adı veya
  yolu** içinde geçmeli (terim-AND) → "fren balata" hem "Fren tertibatı /
  Fren balatası"nı bulur. Karşılaştırma `normalizePartSearchTerm` ile katlanmış
  metin üzerinde (Türkçe/aksan duyarsız, ayraç duyarsız), server tarafıyla aynı
  anahtar üretimi.
- Sıralama: önce düğümün kendi adında eşleşenler, sonra yol eşleşmeleri; her grupta
  `localeCompare(tr)`.
- `limit` varsayılan 12; aşılırsa çağıran taraf "+n kategori daha" notu gösterir.

### API `limit`

`route.ts` `limit` query paramını okur, `parsePositiveInt` ile ayrıştırır ve
`Math.min(50, ...)` ile kırpar (server-side doğrulama; istemciye güvenilmez).
Verilmezse `searchVehicleArticles` varsayılanı (20) korunur → `part-search-input`
davranışı değişmez. Modal 50 ister.

### Durum geçişleri (bayat durum riski)

- Modal her açılışta bugünkü gibi sıfırdan başlar; ek olarak arama sorgusu ve
  marka çipi seçimi de sıfırlanır.
- Kategoriye girildiğinde (`openLeaf` / `stack` push) global sorgu temizlenir.
- Global aramaya geçişte `tree == null` ise (açılışta doğrudan kategoriye
  atlanmış olabilir) `loadCategories()` tembel yüklenir.
- Kapsam çipi kaldırılınca `articles`, `stack`, `supplierFilter` temizlenir.

## Kapsam dışı (YAGNI)

- Sağlayıcıdan canlı arama (kota + sağlayıcıda uç yok).
- Ayrı "Markalar" bölümü / marka detay listesi.
- Arama sonucu sayfalama (limit 50 + daraltma notu yeterli).
- Sunucu tarafı kategori arama endpoint'i (ağaç zaten client'ta).

## Test

- `lib/tecdoc/tree.test.ts` (yeni): `searchCategoryTree` — Türkçe katlama
  ("supurge" ↔ "süpürge"), terim-AND, yol eşleşmesi, kendi-adı önceliği, limit.
- Manuel QA: aşağıdaki adımlar.

## Manuel QA adımları

1. VIN'i kataloğa bağlı bir aracın iş emrinde Parça sekmesi → "Araca Uygun Parçalar".
2. Kök seviyede "fren" yaz → KATEGORİLER bölümünde fren dalları + PARÇALAR bölümünde
   cache'li fren parçaları.
3. Marka adı yaz ("bosch") → o markanın parçaları; marka çipine bas → liste daralır.
4. Kategori sonucuna bas → o kategorinin parça listesi açılır, sorgu temizlenir.
5. Kategori içinde ara → sadece o kategoride süzer; kapsam çipini kaldır → global
   sonuçlara geçer, sorgu korunur.
6. Hiç eşleşmeyen bir şey yaz → boş durum + kapsam notu görünür.
7. Parça satırından ⓘ → detay modalı açılır (parça seçilmez).
8. Arama sonucundan parça seç → satıra doğru kategori adıyla düşer.
9. Mobil genişlikte (375 px) başlık + arama + çipler taşmıyor, dokunma hedefleri ≥ 44 px.

## Risk

- **Düşük**: şema yok, yeni sağlayıcı isteği yok, mevcut drill-down davranışı boş
  sorguda birebir korunuyor.
- Dosya ayrıştırması `part-detail-dialog` gibi tüketicileri etkilemez (yalnız
  `TecdocPartPicker` dışa aktarımı sabit kalır); `VinLinkPrompt` zaten dışa
  aktarılmıyordu.
