# Teknisyen iş ekranı (kiosk 2/2, #1036) — uygulama planı

Spec: `docs/superpowers/specs/2026-11-27-technician-kiosk-design.md` (iş ekranı bölümü).
Önceki dilim: `docs/superpowers/plans/2026-11-27-technician-kiosk-home.md` (#1035).

Migration yok, yeni yetki yok, yeni timeline `eventType` yok. `[deploy-dev]` gerekmez.

## Kararlar (orkestratör)
- Tek tuş: İşi Başlat = durum Serviste + işçilik sayacı; Ara Ver yalnız sayacı durdurur;
  "Parça bekliyor" ikincil, önce sayacı kapatır; İşi Bitir = mevcut `completeWorkAction` kapısı.
- Dış Parça / Dış İşçilik bu PR'da mevcut ortalanmış Dialog'larıyla kutucuktan açılır
  (telefonda alttan sayfaya çevirme = takip issue'su). Parça, İşçilik, Fotoğraf, Not,
  Araç Kontrolü alttan sayfa.
- Masaüstünde (lg+) alttan sayfa yerine ortalanmış Dialog: grid `addSurface` telefonda
  `"sheet"`, lg+'da `"dialog"` (mevcut `useIsMobile`/media-query hook'u varsa onu kullan;
  hidrasyonda yanlış yüzey yanıp sönmesin — sayfa yalnız etkileşimle açıldığı için
  ilk render'da kapalı olması yeterli).
- Çift başlatma koruması: transaction içinde `tx.$queryRaw` ile
  `SELECT id FROM "ServiceOrder" WHERE id = … AND "workshopId" = … FOR UPDATE`
  (tablo/kolon adlarını şemadan doğrula). No-op `updateMany`'ye güvenme.
- `canPurchase` = `actorCan(user, "parts.purchase")` VE atölyede `procurement` özelliği
  (mevcut `hasFeature` benzeri yardımcı varsa). Özellik yoksa kutucuk görünmez.
- Başlıktaki ofis iş emri bağlantısı yalnız `canEditOrder` iken.

## Görevler

### 1. Saf kurallar (önce test)
`src/lib/technician/work-screen.ts` (React/prisma yok):
- `type WorkScreenPermissions = { canEditOrder; canChangeStatus; canPurchase; canAddPhoto }` (hepsi boolean)
- `type WorkTileKey = "part" | "labor" | "purchase" | "externalLabor" | "photo" | "note"`
- `workScreenTiles(p, locked): WorkTileKey[]` — locked → `[]`; sıra: part, labor
  (canEditOrder), purchase (canPurchase), externalLabor (canEditOrder), photo (canAddPhoto),
  note (canEditOrder).
- `type WorkPrimaryAction = "start" | "resume" | "pause" | null`
- `workPrimaryAction(status, hasActiveLabor, canChangeStatus)` — `!canChangeStatus`,
  `isOrderLocked(status)` veya `ready_for_delivery` → null; açık oturum → `pause`;
  `in_progress` + oturum yok → `resume`; `draft | waiting_approval | approved | waiting_parts`
  → `start` (bileşendeki mevcut `canStart` listesi).
- `canHoldWork(status, canChangeStatus)` (= in_progress), `canCompleteWork(status, canChangeStatus)`
  (= in_progress | waiting_parts) — bileşenden taşınır.

Testler `src/lib/technician/work-screen.test.ts`: usta/staff altı kutucuk sırayla; çırak
`["purchase","photo"]`; kilitli iş `[]`; durum→eylem tablosu; `canChangeStatus=false` → hep null;
Parça bekliyor yalnız Serviste; İşi Bitir yalnız Serviste/Parça Bekliyor. Yetkiler `roleCan`'dan türetilir.

### 2. Sunucu action'ları — `src/app/(app)/technician/actions.ts`
- Dışa açılmayan `closeActiveLaborSession(tx, workshopId, orderId, note?)` →
  `{ sessionId, durationMinutes } | null`; `stopLaborSessionAction`'daki koşullu `updateMany`
  ve süre hesabı. `stopLaborSessionAction` bunu kullanır (hata/dönüş/audit aynı).
- `startWorkWithTimerAction(orderId)` → `{ success: true; statusChanged; timerStarted } | { error }`:
  kardeşleriyle aynı `requireWritableWorkshop("order.status")` deseni (rbac-coverage);
  sipariş `{ id, workshopId: user.workshopId }` ile okunur; bulunamadı / `ORDER_LOCKED_ERROR` /
  `workPrimaryAction` null → "Bu durum geçişine izin verilmiyor". Tek `$transaction`:
  FOR UPDATE kilidi → durum `in_progress` değilse okunan duruma koşullu `updateMany`
  (count 0 → "Durum bu sırada değişti, sayfayı yenileyin") → açık oturum yoksa oluştur
  (çift dokunuş hata değil, `timerStarted: false`). Commit sonrası: `statusChanged` ise
  `work_started` audit + timeline ("Tamire başlandı"); `timerStarted` ise
  `labor_session_started` audit (startLaborSessionAction ile aynı metadata). `startWorkAction`
  ile aynı `revalidatePath`'ler.
- `holdWorkAction`: transaction içinde koşullu `waiting_parts` + `closeActiveLaborSession`;
  kapatıldıysa commit sonrası `labor_session_stopped` audit. İmza aynı.
- `completeWorkAction`: kapı sırası aynı (`canTransitionOrder`, sonra
  `completeWorkBlockMessage(countIncompleteItems(items))`, her yazmadan ÖNCE); tek transaction:
  durum + `completedAt` + `closeActiveLaborSession`. İmza aynı.
- `startWorkAction` yalnız çağıran kalmadıysa silinir (PR #1018 aynı dosyada temizlik yapıyor —
  origin/dev'i birleştir).

### 3. Ortak editör — yalnız ek prop'lar
`src/components/orders/parts-labor-grid.tsx` (`PartsLaborEditor` + `PartsLaborGrid` aktarımı):
- `addSurface?: "dialog" | "sheet"` (varsayılan `"dialog"`). Mevcut
  `<DialogContent className="sm:max-w-2xl" onCloseAutoFocus={onAddDialogCloseAutoFocus}>`
  satırı byte-byte aynı kalır (`work-order-detail.test.ts:350`). `"sheet"` → aynı iki composer
  `BottomSheet` içinde, aynı başlıkla; composer JSX tek yerde.
- `hideAddToolbar?: boolean` → `data-pl="toolbar"` bloğu çizilmez.
- Teknisyen sarmalayıcısına `compactRows` ekleme (`parts-labor-compact.test.ts:55`).

`src/components/technician/technician-parts-labor-section.tsx` (BAK-141; `PartsLaborGrid`
importu kalır): `addingType`, `onAddingTypeChange` prop'ları; `addSurface` (yukarıdaki kural)
`hideAddToolbar allowExternalLabor={false}`; tonlu `bg-primary/[0.04]` kalkar, düz kart;
`!canEditOrder` için istek-yalnız `Alert` kalır; `parts-labor.module.css` import edilmez.
`src/lib/technician/item-editing.ts`: `REQUEST_ONLY_MESSAGE` → "Dış Parça kutucuğu".

### 4. Mevcut teknisyen bileşenlerinde küçük açılımlar
- `external-labor-sheet.tsx`: `ExternalLaborSheet` export.
- `technician-photo-upload.tsx`: opsiyonel kontrollü `open`, `onOpenChange`, `hideTrigger`.
- `labor-session-card.tsx`: `StopLaborButton` opsiyonel `label`, `size`, `variant`;
  `LaborSessionCard` tonlu arka plan kalkar. Ofis kullanımı (`technician-progress-panel.tsx`) aynı.
- `order-items-checklist.tsx`: opsiyonel `onEditItem(itemId)`; verilince satır = sol tik
  `Button` (ikon boyutu, `aria-pressed`) + satırın kalanı `Button variant="ghost" size="row"`;
  verilmezse bugünkü tüm satır tik davranışı. `useOptimistic`, animasyonlar, "Tümünü kaldır"
  korunur (`order-items.test.ts`).

### 5. Ekran
`technician-order-detail.tsx` orkestratöre döner (~450 satır hedef). `canEditOrder` prop'u yerine
`permissions: WorkScreenPermissions`. Kalkar: `TECHNICIAN_ORDER_STEPS`, `?step=`, localStorage adımı,
`WizardActions`, `Tabs`, tüm `bg-primary/[0.04]`. Bu dosyada kalır (`purchase-photos.test.ts`):
`groupPurchasePhotos(order.photos)`, `photos.length > 0 ? (`, `<PhotoThumbnail`. Korunur:
`useOrderSync`, `useChecklistState`, `findUndecidedPartsRequests`, `externalLaborItems`,
`type !== "external_labor"` filtresi, `purchaseDeleteDecision`.

Yukarıdan aşağı: başlık kartı (Plate lg, StatusBadge md, araç, müşteri, şikâyet 2 satır; geri
bağlantı `/technician`) → karar bekleyen parça isteği Alert → birincil eylem (start "İşi Başlat" /
resume "Devam Et" `Button size="xl" w-full` → `startWorkWithTimerAction`, hata `toast.error`,
`router.refresh()`; pause → `StopLaborButton label="Ara Ver"` + çalışan süre) → altında
`canHoldWork` iken ghost "Parça bekliyor" → kutucuk ızgarası → "YAPILACAKLAR n/m"
(`OrderItemsChecklist onEditItem` + parça/işçilik bölümü) → dış alım / dış işçilik kartları →
"ARAÇ KONTROLÜ n/m" satırı (ghost row düğmesi, mevcut kontrol listesi BottomSheet'te) →
kapalı `Collapsible` "Detaylar" → "İşi Bitir" `Button size="xl" variant="success"` +
mevcut `AlertDialog` ve engel mesajı. Kilitli işte kutucuk/birincil/bitir yok. Yapışkan alt bar yok.

Masaüstü: `mx-auto w-full max-w-6xl lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6` — sol:
birincil + kutucuklar + Yapılacaklar; sağ: başlık/müşteri + Araç Kontrolü + Detaylar. Kutucuk
ızgarası `grid-cols-3`, lg'de 1280'de ölçüp 3 ya da 6.

Tarihler `@/lib/format-date` ile; `format-date-coverage.test.ts` `PENDING_MIGRATION`'dan bu dosya
satırı silinir (#1042 önce girdiyse onunkini al).

Yeni dosyalar `src/components/technician/work-screen/`: `work-tile-grid.tsx` (ikon + etiket:
Parça Ekle, İşçilik Ekle, Dış Parça, Dış İşçilik, Fotoğraf, Not; `Button variant="outline"`;
`size="xl"` ikon-üstte-etiket için kısa kalırsa `button.tsx`'e TEK yeni boyut `kiosk` ve
`control-sizing.test.ts`, `control-call-sites.test.ts`, `docs/ui-control-sizing.md` aynı PR'da;
çağrı yerinde h-/rounded-/text- yok), `work-sheets.tsx` (açık kutucuk → yüzey; not = BottomSheet +
`AddInternalNoteForm`, react-hook-form + zod şeması `src/lib/validations/`, `onDone` +
`toast.success("Not eklendi.")`), `work-details.tsx` (CustomerCard, DamageMarks, PhotoSection,
InternalNotesSection, LaborSessionCard geçmişi, OrderTotals olduğu gibi taşınır),
gerekirse `purchase-cards.tsx`.

`src/app/(app)/technician/orders/[id]/page.tsx`: `permissions` geçirilir (`actorCan`;
`canAddPhoto` = `records.create`). Sorgu, tenant kapsamı ve `VISIBLE_PHOTO` aynı. AppShell
prop'larına dokunma.

`technician-order-wizard.test.ts` silinir, `technician-work-screen.test.ts` gelir (kaynak tarama):
orkestratör ve `work-screen/*`'da `?step`, `localStorage`, `WizardActions`,
`TECHNICIAN_ORDER_STEPS`, `bg-primary/[0.04]`, `toLocale` yok; `startWorkWithTimerAction`,
`workScreenTiles(`, `workPrimaryAction(`, `completeWorkBlockMessage(`, `AlertDialog` var;
"Parça bekliyor" bir kez; eski testin değişmezleri (`type !== "external_labor"`,
`externalLaborItems`, `findUndecidedPartsRequests`, `allowExternalLabor={false}`, loading/error
dosyaları); `CollapsibleTrigger asChild` var, `aria-expanded` / `<details` yok; actions kaynağı:
`startWorkWithTimerAction` bloğunda `requireWritableWorkshop("order.status")`, `$transaction`,
`FOR UPDATE`, `workshopId: user.workshopId`; `completeWorkAction`'da `completeWorkBlockMessage(`
`$transaction`'dan önce; hold/complete bloklarında `closeActiveLaborSession(`.
`item-editing.test.ts` yeşil kalır + `addSurface`/`hideAddToolbar` beklentileri; ofis varsayılanı
`addSurface = "dialog"` için bir assert.

## DOKUNMA (#1046 paralel)
`src/lib/sidebarless-route.ts`, `src/components/layout/app-shell.tsx`,
`src/lib/navigation/page-headers.ts` (+test), `src/app/(app)/technician/page.tsx`,
`src/components/technician/technician-dashboard.tsx`, `technician-quick-actions.tsx`.

## Takip issue'ları
`/technician/orders/[id]` → `SUB_PAGE_HEADERS`; Dış Parça/Dış İşçilik telefonda BottomSheet;
açık LaborSession için kısmi unique index; teknisyen formlarında `todayTrString`/
`toDatetimeLocalValue` → `@/lib/istanbul-time`.
