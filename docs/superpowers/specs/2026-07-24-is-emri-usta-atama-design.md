# İş Emrini Ustaya Atama — Tasarım

**Tarih:** 2026-07-24
**Dal:** `feat/is-emri-usta-atama` (base `dev`)
**Worktree:** `.worktrees/feat-is-emri-usta-atama`

## Problem

Atama özelliği kod tabanında baştan sona kurulu, ama kullanıcı için pratikte yok:

| Katman | Durum |
|---|---|
| Şema (`ServiceOrder.assignedTechnicianId`, `assignedAt`, `technicianName`, `Technician`) | Var |
| Server action (`assignTechnicianAction`, `unassignTechnicianAction`) | Var — tenant izolasyonu, kilit kontrolü, AuditLog, timeline |
| Usta CRUD (`/workshop` → `TechnicianManagement`) | Var |
| Ustanın kendi ekranı (`/technician`, `/technician/orders/[id]`) | Var |
| Yöneticinin atama arayüzü | **Yetersiz** |

Tespit edilen boşluklar:

1. Atama kutusu, iş emri detayında **Özet sekmesinin en altındaki "İş Emri Bilgileri"** kartında
   (`order-management-panel.tsx:423-466`). Mobilde 3-4 ekran aşağıda; kullanıcı oraya inmeden
   özelliğin var olduğunu göremiyor.
2. Arayüz çıplak bir çip listesi: arama yok, mevcut iş yükü görünmüyor, onay/toast yok,
   tıklayınca `window.location.reload()`. Çok ustalı bir serviste kullanılamaz.
3. Atölyede hiç usta kayıtlı değilse blok hiç render edilmiyor (`technicians.length > 0` koşulu).
   Yeni kullanıcı için özellik **fiilen yok** — hiçbir yönlendirme de yok.
4. İş emri listesinde ("/orders") "Teknisyen" sütunu yalnız `md+` tabloda; mobil kartta hiç yok,
   ustaya göre filtre yok, listeden atama yok.
5. Dashboard'daki `TechnicianStatusWidget` salt-okunur — sayıları gösteriyor ama hiçbir yere gitmiyor.

**Sonuç: geliştirilecek olan backend değil, erişilebilirlik ve mobil UX.**

## Kapsam Dışı

- Çoklu usta ataması (bir emre birden fazla usta). Tek usta modeli korunuyor.
- Sürükle-bırak dağıtım panosu. Faz D bunun yerine mevcut widget'ı eylemli hale getiriyor.
- Ustaya bildirim/SMS gönderimi.
- `technicianName` legacy alanının temizlenmesi (raporlar hâlâ okuyor).

## Şema

**Değişiklik yok. Migration yok.** Mevcut alanlar yeterli.

## Faz A — Ortak atama bileşeni

Yeni dosya: `src/components/app/technician-assign.tsx`

İki export:

- **`TechnicianAssignSheet`** — mobil-öncelikli sheet/dialog:
  - Arama kutusu (ad üzerinde, `tr-search` yardımcısıyla Türkçe-duyarlı)
  - Her satır: usta adı + rol rozeti + **aktif iş sayısı** ("3 aktif iş")
  - Atanmış usta işaretli; "Atamayı kaldır" ayrı satır
  - **Boş durum**: hiç usta yoksa açıklama + "Usta ekle" → `/workshop`
  - `router.refresh()` + `sonner` toast (mevcut `window.location.reload()` yerine)
  - Kilitli emirde (`delivered`/`cancelled`) salt-okunur; sheet açılmaz
- **`AssignedTechnicianBadge`** — kompakt rozet. Atanmışsa ad + rol; atanmamışsa
  "Usta ata" outline butonu. Tıklayınca sheet açar.

Veri: `getTechnicians(workshopId)` aktif iş sayısını da döndürecek şekilde genişletilir
(`_count.assignedOrders` — `delivered`/`cancelled` hariç). Dönen tip geriye uyumlu genişler.

## Faz B — İş emri detayı

- Başlık bloğunda durum rozetlerinin (`Taslak` / `Ödenmedi`) yanına `AssignedTechnicianBadge`.
  Mobilde ilk ekranda görünür — scroll gerekmez.
- `order-management-panel.tsx` içindeki mevcut çip listesi kaldırılır; "Atanan Usta" satırı
  aynı sheet'i açan tek tetikleyiciye bağlanır. Atama mantığı tek yerde toplanır.

## Faz C — İş emri listesi

- **Mobil kart**: usta rozeti; atanmamışsa "Ata" butonu (aynı sheet).
- **Desktop tablo**: "Teknisyen" hücresi tıklanabilir → aynı sheet.
- **Filtre**: `?technician=<id>` ve `?technician=none` (atanmamışlar).
  Mevcut `FilterSelect` desenine "Usta" filtresi eklenir; `q` / `status` / `payment` ile
  birlikte çalışır.
- Sunucu tarafı `where` üretimi saf bir yardımcı fonksiyona çıkarılır ve `bun test` ile
  birim testi yazılır (mevcut testler saf-lib deseninde).

## Faz D — Dağıtım görünürlüğü

Dashboard'daki `TechnicianStatusWidget` eylemli hale getirilir:

- Her usta satırı → `/orders?technician=<id>`
- Üstte **"Atanmamış (N)"** çipi → `/orders?technician=none`

Faz C'nin filtresini yeniden kullanır; yeni sorgu yüzeyi ve yeni sayfa gerekmez.

## Test Stratejisi

- Filtre `where` üreticisi için birim testleri (`bun test`): usta id'si, `none`,
  boş değer, diğer filtrelerle kombinasyon.
- Mevcut 330 testin geçmeye devam etmesi.
- Elle QA: aşağıdaki adımlar.

## Risk Alanları

- `work-order-detail.tsx` ve `order-management-panel.tsx` büyük dosyalar — yalnız ilgili
  bloklar değişecek, yeniden yazım yok.
- `technicianName` legacy alanı atama sırasında senkron yazılmaya devam etmeli;
  raporlar (`reports/queries.ts`, `analytics/queries.ts`) bu alana bakıyor.
- Yeni `technician` searchParam mevcut filtrelerle birleşince sorgu doğru kalmalı.
- Tenant izolasyonu: usta listesi ve filtre her zaman `requireAuth()`'tan gelen
  `workshopId` ile sınırlı olmalı; client'tan gelen id doğrulanmadan kullanılmamalı.

## Manuel QA

1. Usta kayıtlı **değilken** iş emri aç → "Usta ata" görünür, tıklayınca "Usta ekle" yönlendirmesi.
2. `/workshop`'tan iki usta ekle → iş emrine dön → ata, toast görünür, sayfa yenilenmeden güncellenir.
3. Mobil genişlikte (375px) iş emri detayı → atanan usta ilk ekranda görünür.
4. `/orders` mobil kartta usta rozeti; "Ata" ile atama yapılır.
5. `/orders?technician=none` yalnız atanmamışları listeler; usta filtresi + durum filtresi birlikte çalışır.
6. Dashboard widget'ında usta satırına tıkla → filtrelenmiş liste açılır.
7. Teslim edilmiş bir emirde atama salt-okunur.
8. İş emri "Geçmiş" sekmesinde `technician_assigned` kaydı görünür.
