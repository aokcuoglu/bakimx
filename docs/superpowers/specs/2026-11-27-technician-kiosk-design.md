# Teknisyen kiosk ekranı — tasarım

Tarih: 2026-11-27 · Issue'lar: #1035 (ana ekran), #1036 (iş ekranı)

## Niyet ve neden

`/technician` ekranlarını ustalar ve teknisyenler kullanıyor. Çoğunlukla kendi
telefonlarından, atölyede, eldiven ya da yağlı elle kullanıyorlar. Bugünkü ekran
iki açıdan sorunlu:

- **Görünüş:** Diğer sayfalarla uyuşmuyor. KPI kartları `!important` ile
  eziliyor, hızlı işlem kutuları ham renkli `Link`, kartlar tint'li
  (`bg-primary/[0.04]`). Diğer sayfalar ise e-santral kalıbında.
- **Kullanım:** İş ekranı 5 adımlı bir sihirbaz. Kalem ekleme ofisin tablet
  düzenindeki `PartsLaborGrid` tablosu/kart listesi. Usta için çok adım ve çok
  küçük hedef var.

Kullanıcının isteği: telefonda bir mobil uygulama/PWA gibi, sidebar'sız, **kiosk
gibi**. Büyük tuşlar olacak; usta kendine atanan işi seçecek ve parça/işçilik
ekleme, fiyat girme, dış parça/dış işçilik gibi her şeyi basit bir arayüzden
halledecek.

**Başarı:** Bir usta, telefonda tek elle şunları ofise sormadan ve yanlış tuşa
basmadan yapabilmeli: işini bulur, başlatır, parça ve işçilik ekler, fiyat girer,
dış alımı kaydeder, fotoğraf çeker, bitirir.

## Hedefler

1. Ana ekran (#1035): "İşlerim" odaklı. Saha rolü önce kendine atanan işleri
   görür; atölyenin geri kalanı (BAK-157 görünürlüğü) altta açılır grupta
   kalır. Büyük iş kartları, büyük Araç Kabul / Parça Ara
   tuşları, açılır Taslak ve Bugün biten grupları var.
2. İş ekranı (#1036): sihirbaz yerine tek sayfa var. Büyük Başlat/Durdur tuşu,
   altı kutucuk ve her kutucuk için alttan açılan sayfa (bottom sheet) var.
   Ardından eklenenlerin özeti, kontrol listesi ilerlemesi ve büyük İşi Bitir
   tuşu gelir.
3. İki ekran da e-santral kalıbında olacak: gruplu gri zemin, çerçevesiz beyaz
   kartlar, hap düğmeler, telefonda 44px+ kontrol (kiosk tuşları daha büyük,
   aşağıya bakın).
4. Mobilde sidebar olmayacak. Mevcut sidebarless kabuk ve PWA manifest'i
   kullanılır.

## Hedef dışı

- Paylaşımlı cihaz / PIN ile kullanıcı değiştirme. Karar **B**: her teknisyen
  kendi telefonunda kendi oturumuyla girer. Kiosk hissi yalnız arayüzden gelir.
- Yeni yetki, yeni rol veya şema değişikliği. Migration yok. Yeni server
  action yalnız mevcut iki action'ı birleştiren ince bir sarmalayıcı olabilir
  (Başlat tuşu, aşağıda); yeni iş kuralı yazılmaz.
- Ofis iş emri ekranı (`/orders/[id]`) ve teklif editörünün davranışı.
- PWA'nın kendisi (manifest, service worker, push). Var olan aynen kalır.
- `/technician/parts` (Parça Sorgulama) sayfasının yeniden tasarımı.

## Başarısızlık sayılacak şeyler (anti-hedefler)

- **Kopya kalem düzenleyici.** BAK-141 gereği teknisyen kalem ekleme ofisin
  ortak düzenleyicisinden geçer. İkinci bir düzenleyici yazmak, ekran güzel
  görünse bile başarısızlıktır: KDV, stok rezervasyonu, TecDoc ve fiyat
  kuralları sessizce ayrışır. Bekçisi: `src/lib/technician/item-editing.test.ts`.
- Bitir kapısının ya da durum geçişlerinin gevşemesi. Eksik kalemle iş
  bitirilemiyorsa yine bitirilememeli.
- Yetkisi olmayan role tuş göstermek ("bas, hata al").
- Kiosk hissi uğruna `Button`'a `h-*` / `rounded-*` / `text-*` ezmesi.
  Büyüklük `size` / `variant` ile verilir. Gerekirse varyant eklenir.
- Ofis ekranlarında görsel ya da davranışsal regresyon (`PartsLaborGrid`'e
  dokunulursa).

## Kısıtlar

- **BAK-141 / ortak düzenleyici:** Teknisyen bileşeni
  `@/components/orders/parts-labor-grid` içinden `PartsLaborGrid` kullanmaya
  devam eder; test bu import'u ve `<PartsLaborGrid` kullanımını arar.
  `PartsLaborGrid` ekleme penceresini dışarıdan yönetmeye zaten izin veriyor:
  `addingType` / `onAddingTypeChange` / `onAddDialogCloseAutoFocus` (bugün
  `Dialog`, `parts-labor-grid.tsx` ~380). `LaborComposer`'ın `modalLayout`
  modu var. Teknisyende `allowExternalLabor={false}`; dış işçilik kendi
  sayfasından eklenir.
- **RBAC:** Yetki mevcut, değişmez:

  | Rol | İzinler | Kiosk'ta görür |
  |---|---|---|
  | usta / staff | `records.manage`, `records.create`, `order.edit`, `order.status`, `parts.purchase` | Hepsi |
  | çırak | `records.create`, `parts.purchase` | Dış Parça (`addPurchaseItemAction` → `parts.purchase`), Fotoğraf. **Dış İşçilik yok**: `ExternalLaborSheet` `/api/orders/items` → `addOrderItemAction` üzerinden `order.edit` ister. Parça/İşçilik Ekle, Not, Başlat/Ara Ver/Bitir, kalem tiki de yok |
  | yönetici rolleri | tam | Hepsi + teknisyen seçimi |

  Görünürlük, sayfanın zaten hesapladığı yetki bayraklarından (`actorCan`,
  `canEditOrder`, …) türetilir. Sunucu tarafı reddi korunur.
- **Kiracı izolasyonu:** Sorgular değişmez. `technicianOrderDetailWhere` ve
  `workshopId` `requireAuth`'tan gelir.
- **Kaynak tarayan kapılar:** `ui-contract`, `theme-tokens`,
  `control-call-sites`, `collapsible`, `nested-radius`, `format-date-coverage`,
  `istanbul-bounds-coverage`, `rbac-coverage`, `photo-visibility`. Şu iki yer
  dokunulursa taşınır:
  - Panodaki `toLocaleDateString("en-CA")` → `istanbulDayKey`.
  - İşçilik saatindeki `toLocaleTimeString("tr-TR")` → `formatTrTime`.
- **Next.js 16:** `params` / `searchParams` Promise'tir.
- **Paralel işler:** Teknisyen dosyalarına dokunan açık PR'lar var:
  - #1017: iç içe köşe; `technician-order-detail`, `purchase-form-sheet`,
    `external-labor-sheet`, `technician-quick-actions`.
  - #1018: ölü teknisyen action'ları.

  Her dilim başlamadan önce `origin/dev`'e merge edilir. Bu PR'lar merge
  olduysa üstüne kurulur, olmadıysa çakışma beklenir ve çözülür. #1019
  (dev-login kullanıcı adıyla) merge olursa e-postasız usta QA'sı kolaylaşır.

## Yaklaşımlar

1. **Yalnız görsel düzeltme:** Mevcut düzen korunur, KPI/hızlı işlem/kartlar
   e-santral'a çekilir, sihirbaz kalır. *Ucuz ama kiosk isteğini karşılamıyor.*
   Usta yine 5 adım ve ofis tablosuyla uğraşır.
2. **Kiosk ana ekran + kutucuklu iş ekranı (SEÇİLDİ):** Ana ekran "İşlerim"e
   odaklanır. İş ekranı tek sayfadır, kutucuklar alttan açılan sayfaları açar.
   Her şey mevcut action'lar, `PartsLaborGrid` composer'ları,
   `PurchaseFormSheet` ve `ExternalLaborSheet` üstüne kurulur. *Orta maliyet.
   Kiosk hissini veriyor, iş kurallarını yeniden yazmıyor.*
3. **Ayrı kiosk uygulaması / paylaşımlı cihaz modu:** Ayrı rota ağacı, PIN ile
   kullanıcı değiştirme, tablet kiosk. *Cihaz kararı B olduğu için gereksiz.*
   Yeni bir kimlik doğrulama yüzeyi açar (güvenlik sınırı genişler).

Kullanıcı **2**'yi seçti. Teslimat iki dilim, iki PR olacak: önce ana ekran,
sonra iş ekranı.

## Karar verilen kısımlar

### Ana ekran (#1035) — `/technician`

```
┌──────────────────────────────┐
│ [logo]            🔔  👤  ⎋   │  sidebarless kabuk (mevcut)
├──────────────────────────────┤
│ Merhaba Usta · 3 iş           │
│ [ Araç Kabul ] [ Parça Ara ]  │  iki büyük tuş, yan yana
│                               │
│ İŞLERİM                       │
│ ┌──────────────────────────┐ │
│ │ 34 ABC 123   ● Serviste   │ │  büyük iş kartı → iş ekranı
│ │ Fiat Egea · Fren sesi     │ │  (çalışan işçilik rozeti)
│ │ ▓▓▓▓░░ 4/6 kontrol        │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ 06 XYZ 45    ○ Parça bekl.│ │
│ └──────────────────────────┘ │
│ ▸ Taslak (2)                  │  Collapsible
│ ▸ Bugün biten (5)             │  Collapsible
└──────────────────────────────┘
```

- **Görünürlük değişmez (kullanıcı kararı):** BAK-157'den beri saha rolleri
  atölyedeki tüm açık işleri görür (`technicianOrderListWhere`,
  `order-visibility.test.ts`). `/orders`'a girişleri yok, yani bu ekran onların
  atölyeyi gördüğü tek yer. Bu korunur; yalnız **sıralama ve odak** değişir:
  - **İşlerim:** kendine atananlar, büyük kartlar, üstte.
  - **Atölyedeki diğer işler** (`Collapsible`): atanmamış ve başkasına atanmış
    açık işler. Ustanın Araç Kabul ile açtığı atanmamış kayıt burada görünür.
  - **Taslak** (`Collapsible`): atölyedeki taslaklar (bugünkü Taslak bölümüyle
    aynı kapsam).
  - **Bugün biten** (`Collapsible`).
- Yönetici rolünde mevcut teknisyen `Select`'i kalır. "İşlerim" seçilen
  teknisyenin işleri olur.
- Liste sırası: önce aktif (in_progress), sonra bekleyen işler.
- Dört KPI filtre kartı ve "Bana atananlar" anahtarı kalkar; ayrımı gruplar
  yapar. Sayılar grup başlıklarında görünür.
- "Son Tamamlananlar" (sayfalı) yerini "Bugün biten" grubuna bırakır.
- Hızlı işlem hedefleri aynı kalır: `/orders/new?entry=plate&from=technician`
  ve `/technician/parts`. Ham `Link` kutuları `Button asChild` + varyant olur.
- Boş durum: "Sana atanmış iş yok". Altında Araç Kabul tuşu.

### İş ekranı (#1036) — `/technician/orders/[id]`

```
┌──────────────────────────────┐
│ ‹  34 ABC 123   ● Serviste    │
│ Fiat Egea 2019 · Ahmet Y.     │
│ "Frenden ses geliyor"         │
│ [■ Ara Ver         00:42:10 ] │  büyük; durum + işçilik sayacı
│ (Parça bekliyor)              │  küçük ikincil tuş
│                               │
│ ┌────────┐┌────────┐┌────────┐│
│ │ Parça  ││İşçilik ││  Dış   ││  kutucuklar 3x2 (telefon),
│ │ Ekle   ││ Ekle   ││ Parça  ││  yetkisiz olan gizli
│ └────────┘└────────┘└────────┘│
│ ┌────────┐┌────────┐┌────────┐│
│ │  Dış   ││Fotoğraf││  Not   ││
│ │İşçilik ││        ││        ││
│ └────────┘└────────┘└────────┘│
│ YAPILACAKLAR 1/2      ₺4.250  │
│ ✓ Fren balatası ×1    ₺1.800  │  tik = kalem yapıldı;
│ ○ Fren işçiliği 1 sa  ₺1.200  │  satıra dokun = düzenle
│ ARAÇ KONTROLÜ ▓▓▓▓░░ 4/6   ›  │  açınca araç kontrol listesi
│ ▸ Detaylar                    │  müşteri, hasar, foto, notlar…
│ [ ✓ İşi Bitir ]               │  büyük, en altta
└──────────────────────────────┘
```

Kutucuk → alttan açılan sayfa:

| Kutucuk | İçerik | Yetki |
|---|---|---|
| Parça Ekle | `PartsLaborGrid`'in parça composer'ı (`addingType="parca"`) | `order.edit` |
| İşçilik Ekle | `PartsLaborGrid`'in işçilik composer'ı (`addingType="iscilik"`, `modalLayout`) | `order.edit` |
| Dış Parça | mevcut `PurchaseFormSheet` | `parts.purchase` |
| Dış İşçilik | mevcut `ExternalLaborSheet` | `order.edit` (sunucu böyle ister) |
| Fotoğraf | mevcut `TechnicianPhotoUpload` (aşama seçimi dahil) | mevcut fotoğraf yetkisi |
| Not | mevcut `AddInternalNoteForm` | `order.edit` |

- Akış her sayfada aynıdır: ara/seç → adet → fiyat → **Kaydet**. Kaydedince
  sayfa kapanır ve `toast.success` gösterilir. Özet listesi yenilenir
  (`useOrderSync` / `router.refresh`).
- **Büyük tuş = iş durumu + işçilik sayacı birlikte (kullanıcı kararı).**
  Bugün ikisi ayrı: `startWorkAction` / `holdWorkAction` (durum; "Durdur"
  aslında `waiting_parts` = Parça bekliyor) ve `startLaborSessionAction` /
  `stopLaborSessionAction` (sayaç, durdururken isteğe bağlı not). Yeni davranış:
  - **İşi Başlat:** durum `canStart` kuralıyla Serviste'ye geçer **ve**
    sayaç başlar. İş zaten Serviste ise yalnız sayaç başlar ("Devam Et").
  - **Ara Ver:** yalnız sayacı durdurur (isteğe bağlı not sorulur); durum
    Serviste kalır.
  - **Parça bekliyor:** küçük ikincil tuş; bugünkü `holdWorkAction`. Açık
    sayaç varsa önce durdurulur.
  - **İşi Bitir:** bugünkü `completeWorkAction`, `AlertDialog` onayı ve
    `completeWorkBlockMessage` kapısı. Açık sayaç kalmamalı (mevcut davranış
    doğrulanır; kalıyorsa bitirirken kapatılır).
  - Hepsi `order.status` ister; çırakta görünmez.
  - İki action'ın birleşimi tercihen sunucuda tek bir ince sarmalayıcıyla
    yapılır (biri başarılı, öteki başarısız yarım kalmasın); iş kuralı mevcut
    action'larda kalır.
- **Kalemin "yapıldı" işareti** (bitir kapısının tek koşulu: her kalemde
  `completedAt`, `countIncompleteItems`) "Yapılacaklar" listesindeki her
  satırın solundaki büyük tiktir (bugünkü `toggleOrderItemCompletedAction`).
  Satırın geri kalanına dokunmak düzenler. Bu liste **araç kontrol
  listesinden** (`checklistProgress`, ARAÇ KONTROLÜ satırı) ayrıdır; ikisi
  karıştırılmaz. Benim kararım.
- **Detaylar** (`Collapsible`, kapalı başlar): bugün sihirbazda olup
  kutucuklara sığmayanlar burada kalır, hiçbiri düşmez. Müşteri kartı
  (telefon), hasar işaretleri, aşama aşama fotoğraf galerisi ve silme, iç
  notlar listesi ve silme, işçilik oturum geçmişi ve düzenleme, karara
  bağlanmamış parça talebi uyarısı (bu uyarı varsa Detaylar dışında, üstte de
  gösterilir). Benim kararım.
- Özet listesindeki bir kaleme dokunmak onu düzenler: parça/işçilik ortak
  düzenleyicinin düzenleme yolundan, dış alım `PurchaseFormSheet` /
  `ExternalLaborSheet` düzenlemesinden. Silme `purchaseDeleteDecision`
  kurallarıyla yapılır.
- Kilitli iş emrinde (teslim/iptal) kutucuklar ve Başlat/Bitir görünmez. Özet
  salt-okunur kalır.
- 5 adımlı sihirbaz ve `?step=` / localStorage adım durumu kalkar.

## Yapıcıya bırakılanlar

- **Ortak düzenleyicinin alttan sayfa olarak sunulması.** Bugün ekleme yüzeyi
  ortalanmış bir `Dialog`. Seçenekler:
  - (a) `PartsLaborGrid`'e sunum prop'u eklemek (ör. `addSurface="sheet"`).
    Varsayılanı bugünkü `Dialog`, ofis ekranları etkilenmez.
  - (b) Composer'ları ortak modülden dışa aktarıp teknisyen `Sheet`'inde
    kullanmak.

  Hangisi seçilirse seçilsin, kalem ekleme ortak koddan geçmeli ve
  `item-editing.test.ts` (gerekirse güncellenerek, gevşetilmeden) bunu bekçilemeli.
- `PartsLaborGrid`'in tablo/kart listesinin kiosk ekranında görünüp
  görünmeyeceği. Görünürse sade özet ile mi değiştirileceği, düzenleme yolunun
  nasıl korunacağı.
- Kiosk tuş büyüklüğü için yeni `Button` `size`'ı (ör. `size="kiosk"`) gerekip
  gerekmediği. Gerekirse `control-sizing` / `control-call-sites` kapılarına
  uygun eklenir ve `docs/ui-control-sizing.md`'ye yazılır.
- Masaüstü yerleşimi. Telefon önceliklidir. Masaüstünde iki kolon (kutucuklar +
  özet) yapıcının kararıdır.
- Bileşenlerin dosyalara bölünmesi. `technician-order-detail.tsx` 1462 satır;
  bölmek serbest, davranış korunur.
- Testler: kutucuk görünürlüğü (rol → kutucuk eşlemesi saf bir fonksiyon olarak
  yazılırsa birim testiyle), ana ekran sıralama/gruplama ve bitir kapısının
  değişmediğinin kanıtı.

## QA

- Worktree sunucusu 32NN portunda, izole yerel DB + seed ile.
- Roller: `admin@bakimx.com` (yönetici), seed'deki `usta` (iş yeri kodu +
  kullanıcı adı), bir çırak.
- 375px ve 1280px genişlikte bakılacaklar:
  - ana ekran boş/dolu;
  - işi başlat → parça ekle → işçilik ekle → dış parça → dış işçilik →
    fotoğraf → not → bitir;
  - eksik kalemle bitir denemesi (kapı);
  - çırakta gizli kutucuklar;
  - kilitli iş emri.
- Klavye: sayfa Escape ile kapanır, odak tetikleyici kutucuğa döner.
