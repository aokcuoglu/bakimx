# Araç kabulünde yakıt seviyesi — tasarım

Tarih: 2026-07-27
Dal: `feat/fuel-level-at-intake` (base: `dev`)
Durum: onaylandı, uygulamaya hazır

## Amaç

Araç servise girerken depodaki yakıt seviyesi kayıt altına alınsın: hem
kademeli bir seçim (E, 1/4, 1/2, 3/4, Full) hem de gösterge panelinin
fotoğrafı. Seviye, hem personel ekranlarında hem de müşteriye açık servis
özetinde araç göstergesine benzeyen bir ibre ile gösterilsin.

Çözdüğü sorun: teslimde "yakıtım eksilmiş" tartışması. Bugün sistemde yakıtın
*cinsi* var (`Vehicle.fuelType`), *seviyesi* yok.

## Kapsam

Dahil:
- Kabulde tek seferlik yakıt seviyesi ölçümü (5 kademe).
- Zorunlu "Yakıt göstergesi" fotoğrafı.
- Yeniden kullanılabilir ibre bileşeni (seçim + salt görünüm).
- Personel ekranları + müşteriye açık sayfa/PDF gösterimi.

Hariç (bilinçli olarak):
- Teslimde ikinci ölçüm / kabul-teslim farkı. Sonraki bir iş.
- Yakıt seviyesinden litre/tutar hesabı. Landing dürüstlük kuralıyla da
  çelişir: tahmini yakıt bedeli gösterilmez.
- Fotoğraftan OCR ile ibre okuma.

## Veri modeli

### `VehicleIntakeForm.fuelLevelAtIntake Int?`

Yüzde olarak saklanır: `0 | 25 | 50 | 75 | 100`. Null = ölçülmedi.

Neden yüzde (enum değil): ileride 1/8 kademe istenirse şema değişmez, sadece
izin verilen değer kümesi genişler. Sunum katmanı `formatFuelLevel()` ile
"1/4", "1/2" gibi Türkçe kesirlere çevirir.

Sunucu doğrulaması izin verilen 5 değerle sınırlanır; ara değer (örn. 30)
reddedilir — böylece "yüzde" temsili UI dilinden (çeyrekler) sapmaz.

### `VehiclePhotoType` enum'una `fuel_gauge`

`src/lib/constants.ts` içindeki foto kontrol listesine
`fuel_gauge: { label: "Yakıt göstergesi", required: true }` eklenir. Kontrol
listesi bu sabitten türediği için wizard, iş emri detayı ve tamamlanma
hesabı ek kod olmadan yeni satırı gösterir.

### Migration etkisi

İki geri-uyumlu DDL: nullable kolon ekleme + enum değeri ekleme. Backfill
yok, veri kaybı yok, mevcut sorgular etkilenmez.

Kabul edilen yan etki: zorunlu foto sayısı 5'ten 6'ya çıktığı için geçmiş
kabullerin foto tamamlanma oranı geriye dönük düşer ("1/10" → "1/11") ve
"Eksik: Yakıt göstergesi" rozeti eski kayıtlarda da görünür. Teslim
edilmiş/iptal edilmiş emirlerde düzenleme zaten kilitli olduğundan bu rozet
yalnızca bilgi amaçlıdır.

## Bileşen: `src/components/intake/fuel-gauge.tsx`

Tek dosya, iki export, tek görsel dil:

- `<FuelGauge value={50} size="sm" | "md" />` — salt görünüm. Inline SVG
  yarım-ay kadran, uçlarında E ve F, ibre `value`'ya göre -90°…+90° arası
  döner, altında kesir metni ("1/2"). Dış bağımlılık yok; PDF çıktısı
  HTML→PDF olduğu için aynı SVG işaretlemesi PDF'te de kullanılabilir
  (PDF tarafında React değil düz HTML string üretilir).
- `<FuelLevelPicker value onChange />` — üstte aynı kadran, altında 5
  seçenekli shadcn `ToggleGroup`: `E · 1/4 · 1/2 · 3/4 · F`. Yükseklik `h-9`,
  mobilde tam genişlik. Sabit/sticky dip bar yok (proje konvansiyonu).

Renk: `value <= 25` ise ibre ve etiket uyarı tonunda, aksi halde lacivert.

Tasarım kararı: seçim ve gösterim aynı kadranı paylaşır; usta ekranda
gördüğü şekli araçtaki göstergeyle birebir eşleştirir.

## Akış

1. **Kabul sihirbazı, Adım 3** (`intake-wizard.tsx`): "Yeni Kilometre"
   alanının hemen altına `FuelLevelPicker`. Alan opsiyoneldir — km de
   opsiyonel, tutarlı kalsın.
2. **Adım 4 (Fotoğraflar):** "Yakıt göstergesi" satırı kontrol listesinde
   otomatik belirir; ayrı kod yok.
3. **İş emri detayı** (`work-order-detail.tsx`): mevcut km düzenleme alanına
   yakıt seçimi eklenir. Aynı `intakeUpdateSchema` üzerinden kaydedilir ve
   AuditLog'a `orderId` ile yazılır (kanıt değil, düzenlenebilir alan).
4. **Sunucu doğrulaması:** `intakeCreateSchema` ve `intakeUpdateSchema` içine
   `fuelLevelAtIntake` eklenir; `workshopId` her zaman `requireAuth()`'tan
   türetilir, istemciden gelen değere güvenilmez.

## Görünürlük

| Yer | Gösterim |
| --- | --- |
| İş emri detayı meta satırı | `⛽ 1/2`, "Giriş KM" ile aynı satırda |
| Araç detayı / araç pasaportu | son kabulün yakıt seviyesi |
| Public servis özeti (`/s/[token]`, `/p/[token]`) | küçük kadran + "Kabulde yakıt: 1/2" |
| PDF (her iki route) | inline SVG kadran |

`src/lib/intake/data-safety.ts` ve `src/lib/passport/data-safety.ts` açık izin
listesi mantığıyla çalıştığından `fuelLevelAtIntake` her ikisine de eklenmezse
müşteri tarafına hiç ulaşmaz. Bu alanın müşteriye açık olması bilinçli bir
karardır (şeffaflık + kanıt).

Not: yeni bir timeline olayı eklenmiyor, dolayısıyla `internalEventTypes`
denylist'lerine dokunulmuyor.

## Hata durumları

- Yakıt seçilmemişse (null): hiçbir yüzeyde "yakıt" satırı/ibresi
  gösterilmez — "bilinmiyor" yerine sessiz gizleme.
- Geçersiz değer sunucuya gelirse: zod 400 döner, kayıt yazılmaz.
- Fotoğraf yüklenmemişse: mevcut eksik-foto akışı devreye girer; kayıt
  engellenmez (bugünkü davranışla aynı).

## Test / doğrulama

Projede otomatik test altyapısı yok; doğrulama şu adımlarla yapılır:

- `bun run lint`, `bun run typecheck`, `bun run build`.
- Migration yerelde `bun run db:migrate` ile yazılır; AWS dev'e `db:deploy`
  ile uygulanır. Worktree izole DB kuralı geçerli (paylaşılan DB'de
  `migrate dev` drift'e girer).
- Manuel QA:
  1. Yeni kabulde yakıt 3/4 seçilir, gösterge fotoğrafı yüklenir.
  2. İş emri detayında ibre ve "Eksik" listesinin doğru güncellendiği görülür.
  3. Public link + PDF'te ibre ve "Kabulde yakıt" satırı görünür.
  4. Yakıt seçilmemiş eski bir kabulde hiçbir yüzeyde yakıt satırı çıkmaz.
  5. Mobil genişlikte 5 buton taşmadan sığar.

## Dokunulacak dosyalar

- `prisma/schema.prisma` + yeni migration
- `src/lib/constants.ts` (foto tipi etiketi)
- `src/lib/format.ts` (`formatFuelLevel`)
- `src/lib/validations/intake.ts`
- `src/app/(app)/intakes/actions.ts`
- `src/app/api/intakes/[id]/route.ts`
- `src/components/intake/fuel-gauge.tsx` (yeni)
- `src/components/intake/intake-wizard.tsx`
- `src/components/orders/work-order-detail.tsx`
- `src/app/(app)/orders/[id]/page.tsx` (veri geçişi)
- `src/components/intake/public-share-page.tsx`
- `src/components/vehicles/vehicle-detail.tsx`
- `src/components/vehicles/vehicle-passport.tsx`
- `src/app/p/[token]/page.tsx` (veri geçişi)
- `src/lib/intake/data-safety.ts`
- `src/lib/passport/data-safety.ts`
- `src/app/s/[token]/pdf/route.ts`
- `src/app/p/[token]/pdf/route.ts`
