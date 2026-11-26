import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { NEXT_STATUSES } from "@/components/orders/order-management-panel"

const SOURCE = readFileSync(join(import.meta.dir, "work-order-detail.tsx"), "utf8")
const SECTION_SCROLL = readFileSync(join(import.meta.dir, "use-order-section-scroll.ts"), "utf8")
const PANEL = readFileSync(join(import.meta.dir, "order-management-panel.tsx"), "utf8")
const PAGE = readFileSync(
  join(import.meta.dir, "..", "..", "app", "(app)", "orders", "[id]", "page.tsx"),
  "utf8",
)

/**
 * BAK-102 — "Aracı Getiren" / "Aracı Teslim Alacak" bloğu opsiyonel bir alanı
 * gösteriyor ve BOŞKEN DE görünmek zorunda: gizlendiği sürece servis kullanıcısı
 * alanın var olduğunu fark etmiyor (Kızıldağ Oto geri bildirimi). Koşulun geri
 * eklenmesi ne TypeScript'e ne lint'e takılır, bu yüzden sözleşme kaynak
 * üzerinden korunuyor.
 */

test("getiren/teslim alacak bloğu 'yalnız doluysa' koşuluna geri dönmez", () => {
  expect(SOURCE).not.toMatch(/order\.intake\.droppedOffByName\s*\|\|\s*order\.intake\.pickedUpByName/)
  expect(SOURCE).not.toMatch(/\{order\.intake\.droppedOffByName\s*&&/)
  expect(SOURCE).not.toMatch(/\{order\.intake\.pickedUpByName\s*&&/)
})

test("her iki blok da boş durum metniyle render edilir", () => {
  const rendered = [...SOURCE.matchAll(/<HandoverPerson[\s\S]*?\/>/g)].map((m) => m[0])
  expect(rendered).toHaveLength(2)
  expect(rendered[0]).toContain('label="Aracı Getiren"')
  expect(rendered[1]).toContain('label="Aracı Teslim Alacak"')
  for (const block of rendered) {
    expect(block).toMatch(/emptyText="Belirtilmedi[^"]+"/)
  }
})

test("telefon tıklanabilir kalır", () => {
  expect(SOURCE).toContain("href={`tel:${phone}`}")
})

/**
 * Düzenleme aksiyonu (başlıktaki "Düzenle" ve boş bloktaki "Bilgi ekle") yalnız
 * `order.edit` yetkisi olan ve kilitli olmayan emirde görünür. Sunucu kapısı
 * `updateIntakeDetailsAction` içinde; buradaki yalnız görünürlük.
 */
/**
 * #911 — bölüm gezinmesi (çip, atlama) yalnız hash'i değiştirir:
 * `history.replaceState(null, …)`, sayfa (Prisma + aktivite) yeniden üretilmez.
 * Eski `?tab=` yalnız istemcide, açılışta bölüme çevrilir ve bir kez
 * `router.replace(…, { scroll: false })` ile adresten düşer.
 */
test("bölüm gezinmesi sunucu navigasyonu tetiklemez", () => {
  expect(SECTION_SCROLL).toContain('window.history.replaceState(null, "", sectionUrl(window.location.href, id))')
  expect(SECTION_SCROLL).toContain('const tab = new URLSearchParams(window.location.search).get("tab")')
  expect(SECTION_SCROLL).toContain("sectionForLegacyTab(tab)")
  expect(SOURCE).toContain("useOrderSectionScroll(pageRef, railRef)")
  expect(SOURCE).not.toContain("router.replace(`/orders/${order.id}?tab=")
  expect(SOURCE).not.toContain("useSearchParams")
  expect(SOURCE).not.toContain("parseOrderTab")
})

/**
 * #911 düzeltme — Next'in yamaladığı `replaceState`, `window.history.state`
 * (`__NA: true`) ile çağrılınca yönlendiricinin adresini güncellemiyor; sonraki
 * `router.refresh()` (foto yükleme, durum değişimi, useOrderSync) eski adresi
 * geri yazıyordu. İlk argüman her yerde `null`.
 *
 * Sorgu (`?tab=`, `?edit=`) ise replaceState ile DEĞİŞMEZ: sayfa `searchParams`
 * aldığı için sorgu sayfa segmentinin anahtarı; yalnız tarayıcı adresi
 * değişince sonraki `router.refresh()` ağaç uyuşmazlığına düşüp sayfayı en
 * üste (ya da hash'e) atıyordu (ölçüm: y 2500 → 0). Sorgu `router.replace(…,
 * { scroll: false })` ile düşer.
 */
test("replaceState yalnız hash'i değiştirir ve Next'in iç durumunu taşımaz", () => {
  for (const src of [SOURCE, SECTION_SCROLL]) {
    expect(src).not.toContain("replaceState(window.history.state")
    for (const call of src.match(/window\.history\.replaceState\([^\n]*/g) ?? []) {
      expect(call).toBe('window.history.replaceState(null, "", sectionUrl(window.location.href, id))')
    }
  }
  for (const src of [SOURCE, SECTION_SCROLL]) {
    for (const call of src.match(/router\.replace\(\w[^\n]*/g) ?? []) {
      expect(call).toEndWith("{ scroll: false })")
    }
  }
  // Tarama boşa dönmesin: bir hash yazımı, iki sorgu temizliği (?tab=, ?edit=).
  expect(SECTION_SCROLL.match(/window\.history\.replaceState\(/g)).toHaveLength(1)
  expect([SOURCE, SECTION_SCROLL].flatMap((src) => src.match(/router\.replace\(\w/g) ?? [])).toHaveLength(2)
})

test("?edit=1 Şikayet penceresi kapanınca adresten düşer", () => {
  const effect = SOURCE.slice(SOURCE.indexOf("const [editingInfo, setEditingInfo]"))
  const body = effect.slice(0, effect.indexOf("}, [editingInfo, router])"))
  expect(body).toContain("if (editingInfo) return")
  expect(body).toContain('urlWithout(window.location.href, ["edit"])')
  expect(body).toContain("router.replace(next, { scroll: false })")
  // #913: kapanış yolu aynı — Esc / İptal / dışarı tıklama `editingInfo`yu düşürür,
  // etkiyi o tetikler. Odak dönüşü (`onCloseAutoFocus`) yalnız odak verir; adrese,
  // pencere durumuna ve yönlendiriciye dokunmaz.
  expect(SOURCE).toContain("<Dialog open={editingInfo} onOpenChange={(open) => { if (!savingInfo) setEditingInfo(open) }}>")
  const HOOK = readFileSync(join(import.meta.dir, "..", "..", "hooks", "use-return-focus.ts"), "utf8")
  for (const forbidden of ["history", "router", "location", "useEffect", "setState"]) {
    expect(HOOK).not.toContain(forbidden)
  }
})

/**
 * #860 → #911 — sol kayıt sütunu geri gelmez: müşteri ve araç kaydı tek kez
 * render edilir; iki kolonda sağdaki rayda, tek kolonda Özet bölümünde (CSS
 * `order`). Yalnız dar ekranda görünen tutar şeridi geri gelmez; #912'den beri
 * her genişlikteki şerit de yok (para raydaki Ödeme kartında).
 */
test("sol kayıt sütunu yok; kayıt rayda tek kez, tutar şeridi yok", () => {
  expect(SOURCE).not.toContain("lg:grid-cols-[320px_minmax(0,1fr)]")
  expect(SOURCE).not.toMatch(/<OrderRecordRail[^>]*className=/)
  expect(SOURCE.match(/<OrderRecordRail\b/g)).toHaveLength(1)
  const rail = SOURCE.slice(SOURCE.indexOf("className={detail.rail}"))
  expect(rail).toContain("<OrderRecordRail order={order} customerName={customerName} />")
  const record = rail.slice(0, rail.indexOf("<OrderRecordRail"))
  expect(record.slice(record.lastIndexOf("<div "))).toContain('data-section="ozet"')
  expect(SOURCE).not.toMatch(/px-4 py-2\.5 text-sm lg:hidden/)
  expect(SOURCE).not.toContain("px-4 py-2.5 text-sm\", detail.shell")
})

test("Müşteri & Araç paneli Araç Kabul Bilgileri'ni tekrar etmez", () => {
  const RAIL = readFileSync(join(import.meta.dir, "order-record-rail.tsx"), "utf8")
  expect(RAIL).toContain('title="Müşteri & Araç"')
  expect(RAIL).toContain("detail.kvCols")
  for (const label of ["Araç kabulü", "Kabul", "Usta", "Geliş", "Toplam", "Kalan"]) {
    expect(RAIL).not.toContain(`label="${label}"`)
  }
})

test("düzenleme aksiyonu order.edit yetkisine bağlıdır", () => {
  expect(SOURCE).toContain("const canOpenInfoEditor = canEditInfo && !orderLocked")
  // Başlıktaki "Düzenle" ve boş durumdaki "Bilgi ekle" aynı kapıdan geçer.
  expect(SOURCE).toContain("{!editingInfo && canOpenInfoEditor && (")
  expect(SOURCE).toContain("onAdd={canOpenInfoEditor ? startEditInfo : undefined}")
  // ?edit=1 ile gelmek yetkisiz kullanıcıda editörü açmaz.
  expect(SOURCE).toContain("editInitially && !orderLocked && canEditInfo")
  // Yetki sunucudan gelir; istemci varsayılanı kapalıdır.
  expect(SOURCE).toContain("canEditInfo = false")
  expect(PAGE).toContain('canEditInfo={actorCan(user, "order.edit")}')
})

/**
 * #881 — hızlı butonlar başlığın hemen altında durur ve asıl düğmelerle aynı
 * kapıdan geçer: tahsilat kilidi hızlı buton ile Ödeme kartındaki "Tahsilat al"
 * arasında tek değişkendir (#912), pencereler kendi bileşenlerinde kalır
 * (yalnız dışarıdan açılır).
 */
test("hızlı butonlar başlığın altında, asıl pencereleri açar", () => {
  const afterHeader = SOURCE.slice(SOURCE.indexOf("actions={headerActions}"))
  expect(afterHeader.indexOf("<OrderQuickActions")).toBeLessThan(afterHeader.indexOf("{error && ("))
  expect(SOURCE).toContain("orderQuickActions({ orderLocked, canCashbox, collectionsLocked })")
  expect(SOURCE).toContain("collectionsLocked={collectionsLocked}")
  expect(SOURCE).toContain("addingType={partsAddType} onAddingTypeChange={setPartsAddType}")
  expect(SOURCE).toContain("onCollectionModalOpenChange={setCollectionModalOpen}")
  // Kart zaten ekranda: kartın düğmesi pencereyi kaydırmadan ve adrese
  // dokunmadan açar; bölüme kaydırma yalnız başlık altındaki hızlı işlemde.
  // #913: ikisi de açan düğmeyi hatırlar (pencere kapanınca odak oraya döner).
  expect(SOURCE).toContain("onCollect={canCashbox && !collectionsLocked ? openCollection : undefined}")
  const open = SOURCE.slice(SOURCE.indexOf("function openCollection("))
  const openBody = open.slice(0, open.indexOf("\n  }\n"))
  expect(openBody).toContain("rememberFocus(opener)")
  expect(openBody).toContain("setCollectionModalOpen(true)")
  expect(openBody).not.toContain("scrollToOrderSection")
  expect(openBody).not.toContain("replaceState")
  const quick = SOURCE.slice(SOURCE.indexOf("function handleQuickAction("))
  const tahsilat = quick.slice(quick.indexOf('if (action === "tahsilat")'))
  expect(tahsilat.slice(0, tahsilat.indexOf("return"))).toContain('scrollToOrderSection("odeme", { focus: false })')
  expect(tahsilat.slice(0, tahsilat.indexOf("return"))).toContain("openCollection(opener)")
})

/**
 * #912 — hap tutarlarla aynı sayılardan; tahsilat kilidi sunucudaki kapıyla
 * (createCollectionAction, önbellekteki ödeme durumu) aynı girdiden.
 */
test("ödeme hapı tutarlardan, tahsilat kilidi sunucu kapısının girdisinden", () => {
  expect(PAGE).toContain("const paymentStatus = orderDisplayPaymentStatus({")
  expect(PAGE).toContain("ledgerLoaded: canCashbox,")
  expect(PAGE).toContain('order.status === "cancelled" || isCollectionLockedForOrder(order.status, order.paymentStatus)')
  expect(SOURCE).toContain("const collectionsLocked = order.collectionsLocked")
  expect(SOURCE).not.toContain("isCollectionLockedForOrder")
})

/**
 * #912 — para tek yerde. Genel Toplam / Tahsil Edilen / Kalan yalnız raydaki
 * Ödeme kartında; Ödemeler bölümü yalnız tahsilat listesini taşır. "Ödenen" ile
 * "Tahsil Edilen" iki ayrı kaynaktan okunabiliyordu (`order.paidAmount ||
 * defter`): artık tek etiket, tek kaynak (`orderPaidKurus`).
 */
test("para tek yerde: tek etiket, tek kaynak, Ödemeler'de toplam ve ekleme düğmesi yok", () => {
  expect(PANEL).not.toContain("Tahsilat Ekle")
  expect(PANEL.match(/label="Tahsil Edilen"/g)).toHaveLength(1)
  expect(PANEL.match(/title="Ödeme Özeti"/g)).toHaveLength(1)
  expect(PANEL).not.toContain("Ödenen")
  expect(SOURCE).not.toContain("Ödenen")
  expect(SOURCE).not.toContain('title="Ödeme Özeti"')
  const history = PANEL.slice(PANEL.indexOf("export function PaymentHistoryCard"))
  expect(history).not.toContain('label="Genel Toplam"')
  expect(history).not.toContain('label="Kalan"')
  expect(history).not.toContain("useState")
  expect(PAGE).toContain("const paidAmount = orderPaidKurus({")
  expect(PAGE).not.toContain("order.paidAmount ||")
})

/**
 * #912 — durum yalnız başlıktan değişir. Bilgi kartındaki Durum Select'i
 * kalktı; onunla birlikte oradaki iptal onayı da gitti. Kapı korunur: başlıktaki
 * İptal onay penceresini açar, POST yalnız pencere onaylanınca gider (eskiden
 * başlık iki durumda iptali tek dokunuşla yazıyordu; bu bilinçli sıkılaştırma).
 */
test("başlıktaki İptal onay penceresi açar, durumu doğrudan yazmaz", () => {
  const mapping = SOURCE.slice(SOURCE.indexOf("const headerActions: DetailHeaderAction[]"))
  const onClick = mapping.slice(0, mapping.indexOf("tone:"))
  expect(onClick).toContain('a.key === "cancelled"')
  expect(onClick).toContain("? requestCancel")
  expect(SOURCE).toMatch(/function requestCancel\(\) \{\n\s+setError\(""\)\n\s+setConfirmCancelOpen\(true\)\n\s+\}/)
  // `changeStatus("cancelled")` tek yerde: onay penceresinin işleyicisinde.
  expect(SOURCE.match(/changeStatus\("cancelled"\)/g)).toHaveLength(1)
  const confirm = SOURCE.slice(SOURCE.indexOf("async function handleConfirmCancel()"))
  expect(confirm.slice(0, confirm.indexOf("\n  }"))).toContain('changeStatus("cancelled")')
  // Pencere istek sürerken kapanmaz; onay düğmesi kendiliğinden kapatmaz;
  // Vazgeç ile kapanınca pencerede gösterilen hata sayfada asılı kalmaz.
  const dialog = SOURCE.slice(SOURCE.indexOf("<AlertDialog open={confirmCancelOpen}"))
  expect(dialog).toContain("onOpenChange={handleCancelDialogOpenChange}")
  expect(SOURCE).toMatch(/function handleCancelDialogOpenChange\(open: boolean\) \{\n\s+if \(loading\) return\n\s+setConfirmCancelOpen\(open\)\n\s+if \(!open\) setError\(""\)\n\s+\}/)
  // Tahsilat varsa kaydın korunduğu söylenir (iade akışı yok, kayıt silinmez).
  const body = dialog.slice(0, dialog.indexOf("</AlertDialog>"))
  expect(body).toContain("{canCashbox && order.paidAmount > 0 && (")
  expect(body).toContain("tahsilat kayıtları")
  expect(body).toContain("silinmez")
  // Tek açıklama öğesi (aria-describedby tek kimliğe bağlanır).
  expect(body.match(/<AlertDialogDescription\b/g)).toHaveLength(1)
  expect(dialog.slice(0, dialog.indexOf("</AlertDialog>"))).toContain("event.preventDefault()")
  // Metin başlıktaki geri açma aksiyonunun gerçek adını verir.
  expect(dialog.slice(0, dialog.indexOf("</AlertDialog>"))).toContain("&quot;Yeniden Aktif Et&quot;")
  expect(NEXT_STATUSES.cancelled.map((a) => a.label)).toEqual(["Yeniden Aktif Et"])
})

test("İşleme Geri Al ileri geçişin ikonunu (▶) almaz", () => {
  expect(SOURCE).toContain("ready_for_delivery: { in_progress: Undo2 },")
  expect(SOURCE).toContain("icon: ORDER_BACK_ACTION_ICONS[order.status]?.[a.key] ?? ORDER_ACTION_ICONS[a.key],")
})

test("Araç Kabul Bilgileri başlığı tekrarlamaz ve durumu değiştirmez", () => {
  const INFO = readFileSync(join(import.meta.dir, "order-info-card.tsx"), "utf8")
  expect(INFO).toContain('<DetailPanel title="Araç Kabul Bilgileri">')
  for (const gone of ['aria-label="Durum"', "TechnicianAssign", "OrderPaymentPill", "Toplam Tutar", "orderStatusOptions", "/status`"]) {
    expect(INFO).not.toContain(gone)
  }
  // Başlıkta olmayanlar kalır.
  for (const kept of ['label="İş No"', 'label="Oluşturulma"', 'label="Tahmini Teslim"', 'label="Fatura Numarası"', 'label="Fatura Tarihi"', 'aria-label="Servise geliş nedeni"']) {
    expect(INFO).toContain(kept)
  }
  expect(SOURCE).toContain("<OrderInfoCard order={order} />")
})

/**
 * #913 — teslim edilmiş kabul: "Yeniden Aç" Özet bandından başlığın ⋯ menüsüne
 * taşındı (yetkiye bağlı; asıl kapı `reopenDeliveredOrderAction`ta). Durum
 * makinesinin geçişi değil, gerekçeli ayrı bir action: `NEXT_STATUSES`e girmez,
 * başlık aksiyonları ile durum makinesi eşitliği (header-actions.test.ts) korunur.
 * Teslim edilmiş kabulde birincil aksiyon yok; ikincil ton menüye iner.
 */
test("Yeniden Aç başlığın ⋯ menüsünde, yetkiye ve teslim durumuna bağlı", () => {
  const reopen = SOURCE.slice(SOURCE.indexOf('if (canReopen && order.status === "delivered") {'))
  const push = reopen.slice(0, reopen.indexOf("\n  }\n"))
  expect(push).toContain("headerActions.push({")
  expect(push).toContain('key: "reopen"')
  expect(push).toContain('label: "Yeniden Aç"')
  expect(push).toContain("onClick: () => setReopenOpen(true)")
  expect(push).toContain('tone: "secondary"')
  expect(NEXT_STATUSES.delivered).toEqual([])
  expect(SOURCE).not.toContain("NEXT_STATUSES.delivered")
  // Özet bandı kalktı; Durum kartı yolu tarif eder, kapanış anını yazar.
  expect(SOURCE).not.toContain("Araç kabulü teslim edildi</p>")
  expect(SOURCE).not.toContain("detail.oReopen")
  expect(SOURCE.match(/onClick=\{\(\) => setReopenOpen\(true\)\}/g)).toBeNull()
  const SUMMARY = readFileSync(join(import.meta.dir, "order-status-summary.tsx"), "utf8")
  expect(SUMMARY).toContain("Araç geri geldiyse başlıktaki ⋯ menüsünden yeniden açabilirsiniz.")
  expect(SUMMARY).toContain("{canReopen && status === \"delivered\" && (")
  expect(SUMMARY).toContain("`${what} · ${formatTrDateTime(closedAt)}`")
  expect(SOURCE).toContain("entry.action === `order_status_changed_to_${order.status}`")
})

/**
 * #913 — kapanmış kabulde yarım iş göstergeleri ve ekleme aksiyonları yok: eksik
 * açı düğmeleri kilitli kabulde diyaloğu açamıyordu (diyalog yalnız açık kabulde
 * bağlı), yalnız sayfayı kaydırıyordu.
 */
test("kapanmış kabulde fotoğraf kartları salt okunur", () => {
  expect(SOURCE).toContain("readOnly={orderLocked}")
  expect(SOURCE).toContain("photoCount={vehiclePhotos.length}")
  expect(SOURCE).toContain('<DetailPill tone="neutral">{vehiclePhotos.length} fotoğraf</DetailPill>')
  expect(SOURCE).toContain("onAdd={orderLocked ? undefined : (type, phase, opener) => focusPhoto(type, phase, opener)}")
  expect(SOURCE).toContain("closed={orderLocked}")
  expect(SOURCE).toContain('order.assignedTechnicianName || orderLocked ? "" : "Atama yapıldığında')
  const MATRIX = readFileSync(join(import.meta.dir, "..", "intake", "photo-phase-matrix.tsx"), "utf8")
  expect(MATRIX).toContain("const readOnly = !onAdd")
  expect(MATRIX).toContain("const visibleRows = readOnly ? filledRows(key) : rows")
  expect(MATRIX).toContain("Bu aşamada fotoğraf yok")
  expect(MATRIX).toContain("{!readOnly && requiredRows.length ? `${filled}/${requiredRows.length}` : filled + extra}")
})

/**
 * #913 — tetikleyicisiz pencereler kapanınca odak açan düğmeye döner. Radix
 * modal `Dialog.Content` odağı yalnız kendi `Dialog.Trigger`ına döndürüyor; hızlı
 * işlem ve `?edit=1` pencereleri kapanınca odak BODY'ye düşüyordu. Bölüme kaydırma
 * pencere açılırken odağı bölüme taşımaz (`focus: false`), yoksa açan düğme
 * kaybolur. Dönüşün kendisi `use-return-focus.test.ts`te sınanır.
 */
test("hızlı işlem ve Şikayet pencereleri kapanınca odak açan düğmeye döner", () => {
  expect(SOURCE).toContain("useReturnFocus({\n    preventScroll: true,\n    initial: openInfoEditor ? editInfoButtonRef : null,\n  })")
  // Altı pencere: Şikayet, fotoğraf, İptal onayı, Yeniden Aç (burada) + kalem ekleme, tahsilat (prop).
  expect(SOURCE.match(/onCloseAutoFocus=\{returnFocusOnClose\}/g)).toHaveLength(4)
  expect(SOURCE).toContain("<AlertDialogContent onCloseAutoFocus={returnFocusOnClose}>")
  expect(SOURCE).toContain("onAddDialogCloseAutoFocus={returnFocusOnClose}")
  expect(SOURCE).toContain("onCollectionModalCloseAutoFocus={returnFocusOnClose}")
  // Açan yollar hatırlar; pencere açan kaydırma odağı bölüme taşımaz.
  const quick = SOURCE.slice(SOURCE.indexOf("function handleQuickAction("), SOURCE.indexOf("  return (\n    <div ref={pageRef}"))
  expect(quick.match(/rememberFocus\(opener\)/g)).toHaveLength(2)
  expect(quick).not.toMatch(/scrollToOrderSection\("\w+"\)/)
  const focusPhoto = SOURCE.slice(SOURCE.indexOf("function focusPhoto("), SOURCE.indexOf("function openCollection("))
  expect(focusPhoto).toContain("rememberFocus(opener ?? undefined)\n    setAddingPhoto(true)\n    scrollToOrderSection(\"kanit\", { focus: false })")
  // Kutucuklar açan öğeyi açıkça verir (Safari fare tıklamasında etkin öğe BODY kalır).
  expect(SOURCE).toContain("onMissingPhotoClick={(key, opener) => focusPhoto(key, undefined, opener)}")
  expect(SOURCE).toContain("onAddOther={orderLocked ? undefined : (phase, opener) => {\n                      rememberFocus(opener ?? undefined)")
  const MATRIX = readFileSync(join(import.meta.dir, "..", "intake", "photo-phase-matrix.tsx"), "utf8")
  expect(MATRIX).toContain("onClick={(event) => onAdd(event.currentTarget)}")
  expect(MATRIX).toContain("onClick={(event) => onAddOther(key, event.currentTarget)}")
  expect(MATRIX).toContain("onAdd(type, phase, compareOpenerRef.current)")
  const EVIDENCE = readFileSync(join(import.meta.dir, "..", "intake", "intake-evidence-summary.tsx"), "utf8")
  expect(EVIDENCE).toContain("onClick={(event) => onMissingClick?.(missing[index], event.currentTarget)}")
  // Şikayet: "Bilgi ekle" kaydedilince kalkarsa yedek kalem düğmesi.
  expect(SOURCE).toContain("rememberFocus(opener ?? editInfoButtonRef, editInfoButtonRef)")
  // Başlık: birincil düğme ya da ⋯ (menü öğesi menüyle birlikte kalkar) hatırlanır.
  expect(SOURCE).toContain("rememberOpener={rememberFocus}")
  const HEADER = readFileSync(join(import.meta.dir, "detail-header.tsx"), "utf8")
  expect(HEADER).toContain("rememberOpener?.(overflowTriggerRef.current)\n                          a.onClick()")
  expect(HEADER).toContain("rememberOpener?.(event.currentTarget)\n                primary.onClick()")
  expect(HEADER).toContain("ref={overflowTriggerRef}")
  expect(SOURCE).toContain("ref={editInfoButtonRef}")
  expect(SOURCE).toContain("rememberAddOpener={rememberFocus}")
  const QUICK = readFileSync(join(import.meta.dir, "order-quick-actions.tsx"), "utf8")
  expect(QUICK).toContain("onClick={(event) => onAction(action, event.currentTarget)}")
  // Paylaşılan pencereler dışarıdan gelen işleyiciyi içeriklerine verir.
  const GRID = readFileSync(join(import.meta.dir, "parts-labor-grid.tsx"), "utf8")
  expect(GRID).toContain('<DialogContent className="sm:max-w-2xl" onCloseAutoFocus={onAddDialogCloseAutoFocus}>')
  const MODAL = readFileSync(join(import.meta.dir, "..", "cashbox", "collection-quick-modal.tsx"), "utf8")
  expect(MODAL).toContain("onCloseAutoFocus={onCloseAutoFocus}>")
  expect(PANEL).toContain("onCloseAutoFocus={onCollectionModalCloseAutoFocus}")
  expect(PANEL).toContain("rememberAddOpener?.(addMenuTriggerRef.current)")
  // Kaydırma kancası odağı yalnız istenince taşır.
  expect(SECTION_SCROLL).toContain("if (focus) target.focus({ preventScroll: true })")
})
