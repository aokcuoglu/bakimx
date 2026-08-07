# İşçilik Kataloğu — Tasarım

**Tarih:** 2026-07-31
**Durum:** Onaylandı (uygulama planı bekliyor)

## Sorun

Atölye, Stok / Parçalar ekranında yedek parçalarını tanımlayabiliyor ama işçilik
kalemlerini tanımlayamıyor. İş emri ve teklif ekranlarında işçilik her seferinde
serbest metin olarak yazılıyor; aynı işlem farklı adlarla ve farklı fiyatlarla
kaydediliyor.

Bugün iş emri composer'ında görünen 24 kalemlik işçilik önerisi
`src/lib/labor/mock-labor-catalog.ts` içinde **kod içine gömülü sabit bir
listedir** ve tüm atölyeler için aynıdır. Fiyatlar atölyeden atölyeye değiştiği
için bu liste öneri olmaktan öteye geçemez.

## Amaç

Atölyenin kendi işçilik fiyat listesini Stok / Parçalar ekranından
tanımlayabilmesi; bu listenin iş emri ve teklif ekranlarında öneri olarak
çıkması.

## Kapsam dışı

- **Kalem bazında KDV.** Sistemde KDV yalnız iş emri/teklif seviyesinde tutuluyor
  (`ServiceOrder.taxRate`, bps). İşçilik tanımına KDV oranı koymak, hiçbir
  toplamı etkilemeyen ölü bir alan yaratırdı. Kalem-bazı KDV ayrı bir iş olarak
  ele alınacak.
- **Standart süre / saatlik ücret hesabı.** Fiyat doğrudan girilir.
- **`ServiceOrderItem` → işçilik tanımı yabancı anahtarı.** Kalem, ad ve fiyatın
  kopyasını taşımayı sürdürür; böylece fiyat listesi sonradan değiştiğinde
  geçmiş iş emirleri bozulmaz. "Hangi işçilikten kaç kez yapıldı" raporu
  istendiğinde ayrıca ele alınır.

## Veri modeli

```prisma
model LaborCatalogItem {
  id                String   @id @default(cuid())
  workshopId        String
  workshop          Workshop @relation(fields: [workshopId], references: [id])
  code              String?  // atölye içi işçilik kodu (ör. "ISC-001")
  name              String
  category          String?  // Bakım / Fren / Motor ... (serbest metin)
  defaultPriceKurus Int?     // önerilen birim ücret, KURUŞ (money.ts kontratı)
  description       String?
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([workshopId, code])
  @@unique([workshopId, name])
  @@index([workshopId, isActive])
  @@index([workshopId, name])
}
```

`Workshop` modeline `laborCatalogItems LaborCatalogItem[]` ters ilişkisi eklenir.
Başka hiçbir modele dokunulmaz.

**Kod alanı zorunlu değildir.** Zorunlu olsaydı listeye hızlıca 20 kalem girmek
isteyen atölye gereksiz yavaşlardı. `@@unique([workshopId, code])` PostgreSQL'de
birden çok `NULL`'a izin verdiği için boş kodlar çakışmaz.

**`@@unique([workshopId, name])` — ürün kısıtı.** Bir atölye aynı adla iki
işçilik tanımlayamaz; bu, sadece içe aktarım (preset import) yarışını
DB seviyesinde kapatmak için değil, bilinçli bir ürün kararıdır — aynı isimle
ikinci bir kayıt açmak yerine kullanıcı var olanı düzenlemeye yönlendirilir.

**Migration etkisi:** tek `CREATE TABLE`. Veri taşıma yok, mevcut satırlar
etkilenmiyor, geri alınabilir. Yerelde `bun run db:migrate`, AWS dev'e
`bun run db:deploy`.

### Neden ayrı tablo

`PartStockItem`'a `kind` (part|labor) ayırıcı kolonu eklemek yeni tablodan
kaçınırdı, ama `/parts` sayfası, stok KPI sorguları, `/api/parts/search`, iş emri
parça composer'ı, teklif formu ve raporlar dahil **işçiliği hariç tutmayı unutan
her sorgu sessizce bozulurdu** ve TypeScript bunu yakalamazdı. Ayrıca
`stockQty`, `criticalStockQty`, `supplierId` gibi kolonlar işçilik satırlarında
anlamsız kalırdı.

`WorkshopSettings` içinde JSON dizi seçeneği ise arama/indeks desteği vermez,
eşzamanlı düzenlemede tüm diziyi ezer ve kalem bazlı raporlamayı imkânsız kılar.

## Arayüz

### Sekme yapısı

`/parts?tab=labor` (varsayılan `parts`) — `/settings?tab=team` ile aynı desen.
Derin link ve sayfa yenileme çalışır, sunucu bileşeni sunucuda kalır. Sayfa
sekmeye göre **yalnız** ilgili veriyi çeker: işçilik sekmesindeyken parça
sorgusu ve stok KPI'ları hiç çalışmaz. `src/components/ui/tabs.tsx` kullanılır,
yeni bileşen yazılmaz.

Sekme değiştiğinde `q/status/category/brand` filtre parametreleri temizlenir;
aksi hâlde parça filtresi işçilik listesine sızmış gibi görünür.

### Başlık ve KPI'lar

"Stok / Parçalar" başlığı ve breadcrumb aynı kalır. Sağdaki birincil buton
sekmeye göre `Yeni Parça` ↔ `Yeni İşçilik` olur. Tek birincil buton kuralı
korunur; başlığa ikinci CTA eklenmez.

İşçilik sekmesinde stok KPI'ları anlamsız olduğu için yerlerini üç kart alır:
`Toplam İşçilik` (aktif + pasif) · `Aktif` · `Pasif`.

### Liste

Parça listesiyle aynı iskelet: `md+` tablo, mobilde kart listesi. Kolonlar:
`KOD · İŞÇİLİK · KATEGORİ · VARSAYILAN ÜCRET · DURUM · İŞLEM`. Arama kutusu
ad/kod/kategoride eşleşir; durum filtresi Aktif/Pasif, varsayılanı "Tümü" —
parça listesindeki davranışın aynısı.

### Modal

`Yeni İşçilik` butonu ve satırdaki düzenle ikonu aynı `LaborItemDialog`'u açar
(`src/components/ui/dialog.tsx`). Alanlar:

| Alan | Zorunlu | Not |
|---|---|---|
| Kod | hayır | ≤ 32 karakter, atölye içinde tekil |
| Ad | evet | 1–120 karakter |
| Kategori | hayır | Atölyenin mevcut işçilik kategorilerinden (distinct) Autocomplete + serbest yazım |
| Varsayılan Ücret | hayır | TL girilir, kuruş saklanır |
| Açıklama | hayır | |
| Aktif | — | Switch, varsayılan açık |

### Boş durum ve hazır liste

"Henüz işçilik tanımlanmadı" + iki eylem: `Yeni İşçilik` ve
`Hazır listeden ekle`. İkincisi 24 kalemlik öneri listesini kategori kategori
gösteren bir modal açar; kullanıcı hepsini veya seçtiklerini içe aktarır,
fiyatları sonradan düzenler.

İçe aktarım **ada göre** (büyük/küçük harf ve baş/son boşluk farkına toleranslı)
mevcut kalemleri atlar ve sonucu dürüstçe bildirir:
*"18 kalem eklendi, 6 kalem zaten listenizde vardı."* İki kez basmak listeyi
ikiye katlamaz.

### Silme ve pasifleştirme

Parça tarafındaki desen: pasifleştir (yumuşak) + sil. Silme `AlertDialog` ile
onaylanır. İşçilik tanımı geçmiş iş emirlerine yabancı anahtarla bağlı olmadığı
için silme serbesttir ve geçmiş kayıtları bozmaz — bu, onay metninde belirtilir.

## Veri akışı

**Yeni API endpoint'i yok.** Her iki tüketici de sunucu bileşeni ağacında:
`/orders/[id]` → `OrderManagementPanel` → `PartsLaborGrid`, ve `/quotes/new` →
`QuoteCreateForm`. Atölyenin aktif işçilik listesi sunucuda bir kez çekilip prop
olarak iner; filtreleme istemcide yapılır.

Parça araması için endpoint şarttır, çünkü TecDoc'ta on binlerce kayıt vardır.
İşçilik listesi atölye başına onlarca kalemdir; tek prop olarak taşımak hem daha
hızlıdır (her tuş vuruşunda ağ turu yok) hem daha az kod gerektirir. Liste 500+
kaleme çıkarsa endpoint'e geçiş tek dosyalık bir değişikliktir.

## Dosyalar

**Yeni:**

| Dosya | Sorumluluk |
|---|---|
| `src/lib/labor/queries.ts` | `getLaborCatalog(workshopId)`, `getLaborKPIs(workshopId)` |
| `src/lib/labor/search.ts` | Türkçe-duyarlı aksansız eşleşme (`fold`), liste/iş emri/teklif ortak kullanır |
| `src/lib/labor/presets.ts` | 24 kalemlik sabit öneri listesi — yalnız içe aktarım modalını besler |
| `src/lib/validations/labor.ts` | zod şemaları |
| `src/app/(app)/parts/labor-actions.ts` | create / update / deactivate / delete / importPresets |
| `src/components/labor/labor-list.tsx` | İşçilik sekmesi listesi (tablo + mobil kart) |
| `src/components/labor/labor-item-dialog.tsx` | Oluştur/düzenle modalı |
| `src/components/labor/labor-preset-import-dialog.tsx` | Hazır listeden ekleme modalı |

**Değişen:**

| Dosya | Değişiklik |
|---|---|
| `prisma/schema.prisma` | `LaborCatalogItem` modeli + `Workshop` ters ilişkisi |
| `src/app/(app)/parts/page.tsx` | Sekmeye göre veri çekme |
| `src/components/parts/parts-list.tsx` | Sekme kabuğu, sekmeye duyarlı başlık butonu |
| `src/components/orders/parts-labor-grid.tsx` | Mock katalog yerine prop; `LaborAutocompleteField` |
| `src/components/orders/order-management-panel.tsx` | İşçilik listesi prop geçişi |
| `src/app/(app)/orders/[id]/page.tsx` | İşçilik listesini çekip panele geçir |
| `src/components/quotes/quote-create-form.tsx` | Tip = işçilik iken ad alanı Autocomplete |
| `src/app/(app)/quotes/new/page.tsx` | İşçilik listesini çekip forma geçir |

**Silinen:** `src/lib/labor/mock-labor-catalog.ts` — içeriği `presets.ts` ve
`search.ts` arasında paylaştırılır; `getMockLaborCatalog`/`searchLaborCatalog`
çağrıları kaldırılır.

## Kiracı izolasyonu

Tüm server action'lar `requireWritableWorkshop()` ile `workshopId`'yi oturumdan
türetir; istemciden gelen herhangi bir workshop tanımlayıcısına asla güvenilmez.
Her okuma ve güncelleme `findFirst({ where: { id, workshopId } })` ile kapılanır.
Yazma işlemleri parça tarafındaki gibi `AuditLog`'a düşer.

## "Katalogdan" rozeti

İş emri kaleminin `source` alanı bugün mock listedeki ada birebir eşleşmeyle
belirleniyor. Aynı mantık atölyenin kendi listesiyle sürer: seçim listeden
geldiyse `catalog`, serbest yazıldıysa `manual`. Kullanıcı açısından davranış
değişmez.

## Hata yönetimi

- **Doğrulama (sunucu tarafı, zod):** ad zorunlu (trim, 1–120), kod ≤ 32
  karakter, fiyat negatif olmayan tamsayı kuruş.
- **Kod çakışması:** Prisma `P2002` yakalanıp
  `"Bu işçilik kodu zaten kullanılıyor"` mesajına çevrilir; ham hata kullanıcıya
  sızmaz.
- **Fiyat girişi:** formda TL girilir, `money.ts`'in `liraToKurus` fonksiyonuyla
  kuruşa çevrilir. Yuvarlama mantığı yeniden yazılmaz.
- **İçe aktarım:** atlanan kalem sayısı kullanıcıya bildirilir; sessiz atlama
  yoktur.

## Testler

`bun test` (mevcut desen):

- `src/lib/labor/search.test.ts` — Türkçe aksansız eşleşme
  (`degisim` → "Motor yağı ve filtre değişimi"), kategori üzerinden eşleşme, boş
  sorgunun tüm listeyi döndürmesi.
- `src/lib/labor/presets.test.ts` — içe aktarım ayıklama saf fonksiyonu: mevcut
  adlar + preset listesi → eklenecekler; büyük/küçük harf ve boşluk farkına
  toleranslı.

## Riskler

1. **Mevcut atölyeler bugünkü 24 mock öneriyi kaybeder.** Bilinçli karardır (boş
   başla + içe aktar). Azaltım: iş emri işçilik kutusu boş öneri durumunda
   *"Tanımlı işçilik yok — Stok / İşçilikler'den ekleyebilirsiniz"* ipucu
   gösterir; serbest metin yazımı bugünkü gibi çalışmayı sürdürür, kimse
   engellenmez.
2. **Sekme ve filtre parametrelerinin karışması.** Sekme değişiminde filtreler
   temizlenerek çözülür.
3. **Migration ve paralel worktree.** İş izole bir worktree'de yapılacak; o
   worktree paylaşılan DB üzerinde `migrate dev` çalıştırırsa yabancı-migration
   drift'i oluşur (daha önce yaşandı). Worktree'ye ayrı DB verilir.
4. **Prop zinciri uzuyor.** İşçilik listesi `/orders/[id]` → panel → grid boyunca
   iniyor. Bugünkü veri hacmi için kabul edilebilir; endpoint alternatifi
   gereksiz karmaşıklık olurdu.

## Manuel QA

1. Boş listede `Hazır listeden ekle` → 24 kalem gelir; tekrar basınca "zaten
   vardı" mesajı çıkar, liste ikiye katlanmaz.
2. Kalem düzenleme (fiyat değişikliği) → listede güncel fiyat görünür.
3. Pasifleştirme → kalem iş emri önerilerinde çıkmaz, listede "Pasif" görünür.
4. İş emrinde işçilik kutusuna yazınca öneri çıkar; seçilince ad ve fiyat dolar,
   rozet "katalog" olur. Serbest metin yazımı çalışmayı sürdürür.
5. Teklif formunda tip = İşçilik seçilince aynı öneri davranışı görülür.
6. Mobilde (375 px) sekme geçişi, tablo → kart dönüşümü ve modal kullanılabilir.
7. Başka atölye oturumuyla girildiğinde bu liste görünmez (kiracı izolasyonu).
8. Aynı kodu iki kalemde kullanmayı denemek anlaşılır bir hata mesajı verir.
