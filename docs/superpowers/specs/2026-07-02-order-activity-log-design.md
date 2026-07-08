# İş Emri "İşlem Geçmişi" (Activity Log) — Tasarım

**Tarih:** 2026-07-02
**Durum:** Onaylandı, uygulamaya geçiliyor
**Kapsam:** İş emri detay sayfasında (`/orders/[id]`) personel-içi bir aktivite/log kartı: kim, ne zaman, hangi hareketi yaptı; hangi parça eklendi/çıkarıldı, tahsilat, durum/meta değişimi, foto, hasar.

## Problem

`AuditLog` zaten kim (`actorUserId`) + ne + ne zaman kaydını tutuyor ve tüm ilgili mutasyonlar buraya yazılıyor. Ama:
- Sadece `/admin/audit` sayfasında görünüyor; iş emri detayında yok.
- `AuditLog` order'a doğrudan bağlı değil — her olay farklı entity id'siyle yazılıyor:
  - Durum/ödeme/meta/oluşturma → `entityId = orderId` (kolay)
  - Parça/işçilik → `entityId = item.id` (silinen kalem kaybolur)
  - Tahsilat → `entityId = collection.id`
  - Foto → `entityId = photo.id` (intake'e bağlı)
  - Hasar → **hiç loglanmıyor**

Mevcut ekrandaki "ONAY ZAMAN ÇİZELGESİ" (`IntakeTimelineEvent` / `ApprovalTimeline`) ise: aktör alanı yok, parça/tahsilat yazılmıyor ve **halka açık paylaşım linkinde de gösteriliyor** (müşteriye açık). Personel-içi detay logu oraya konulamaz (sızıntı).

## Yaklaşım (Onaylanan: C)

`AuditLog`'u tek kaynak tutup, iş emri detayına **ayrı, personel-içi "İşlem Geçmişi" kartı** eklenir. Public timeline'a dokunulmaz.

### Kilit içgörü
`ServiceOrder`-entity olayları (oluşturma/durum/ödeme/meta) zaten `entityId = orderId` ile yazılıyor → migration olmadan, geçmiş dahil, tek `where` ile bulunur. Yeni `orderId` kolonu yalnızca **silinen kalemleri** (order_item_removed + since-removed item'ın added kaydı) kurtarmak için gerekir; tahsilat/foto/hasar canlı satırlar üzerinden zaten kayıpsız çekilir.

### 1. Şema (additive migration)
`AuditLog`'a `orderId String?` + `@@index([orderId])`. Nullable, FK yok (mevcut string-entity desenine sadık), veri yeniden yazımı yok → staging/prod'da güvenli. Prisma `migrate dev` → `migrate deploy`.

### 2. Write noktaları
`AuditLogAction` imzasına opsiyonel son parametre `orderId?: string` eklenir.
- `orders/actions.ts`: `service_order_created`, `order_item_added` (+ metadata `{name,type,quantity,unitPrice}`), `order_item_removed` (+ metadata `{name,type,quantity}`, item silinmeden önce okunur), `order_status_changed_to_*`, `order_payment_changed_to_*`, `order_meta_updated` → hepsine `orderId`.
- `cashbox/actions.ts`: `collection_created` (+ metadata `{amount,method}`), `collection_cancelled` (metadata zaten var), `payment_status_changed_to_*` → `orderId` (standalone tahsilatta `serviceOrderId` boşsa `undefined`).
- `intakes/actions.ts` `addDamageMarkAction`: **yeni** `damage_mark_added` audit (entityType `DamageMark`, metadata `{zone,damageType,severity}`; orderId yok, intake üzerinden bağlanır).
- Foto (`photo_uploaded`) zaten metadata'lı; değişmez.

### 3. Okuma: `getOrderActivity` (`src/lib/orders/activity.ts`)
Girdi: `{ workshopId, orderId, intakeFormId }` (page zaten authed context'te bunlara sahip). Tenant izolasyonu `workshopId` ile.
Tek `auditLog.findMany` (belt-and-suspenders `OR`, backfill'siz geçmişi de kapsar):
```
where: { workshopId, OR: [
  { orderId },                                              // yeni: item/collection (silinen dahil)
  { entityType: "ServiceOrder",       entityId: orderId },  // order-level, geçmiş dahil
  { entityType: "ServiceOrderItem",   entityId: { in: currentItemIds } },   // geçmiş mevcut kalemler
  { entityType: "CollectionPayment",  entityId: { in: collectionIds } },    // geçmiş tahsilatlar
  { entityType: "VehiclePhoto",       entityId: { in: photoIds } },
  { entityType: "DamageMark",         entityId: { in: damageIds } },
]}, include: { actorUser: { select: { firstName, lastName, email } } }, orderBy: { createdAt: "desc" }
```
`photoIds/damageIds/collectionIds` intake/order üzerinden light select ile çekilir. Çıktı satırı:
```
{ id, at: ISO, actor: "Ad Soyad" | email | "Sistem", action, category, label(TR), detail? }
```
`category`: create | part | labor | payment | status | meta | photo | damage → ikon eşlemesi UI'da.

### 4. TR etiketleri
Aksiyon → TR metin + kategori eşlemesi `activity.ts` içinde. Kaynaklar: `ORDER_STATUS`, `PAYMENT_STATUS`, `PHOTO_TYPES`, `DAMAGE_TYPES`, `VEHICLE_ZONES` (`@/lib/constants`), `formatTRY` (`@/lib/format`); ödeme yöntemi etiketleri (cash/credit_card/bank_transfer/other) yerel harita. Metadata JSON güvenli parse edilir (bozuksa boş).

### 5. UI
`src/components/app/order-activity-log.tsx` — mobile-first liste kartı: her satır ikon + etiket + (detay) + aktör + saat (`toLocaleString tr-TR`). Uzunsa son N gösterilir + "Tümünü gör". **Yalnız** `work-order-detail.tsx` içinde render (personel-içi); `ApprovalTimeline`/public'e dokunulmaz. Boş durumda "Henüz işlem kaydı yok".
Veri akışı: `page.tsx` (server) `getOrderActivity` çağırır → serialize dizi `WorkOrderDetail`'e prop → karta.

## Kapsam dışı / kabul edilen sınırlar
- Migration öncesi **silinmiş** kalemlerin geçmişi görünmez (kabul edildi: "sadece bundan sonrası", backfill yok).
- Kart salt-görüntü (log düzenlenemez/silinemez).

## Risk alanları
- Migration: additive, düşük risk (nullable kolon + index).
- Her write noktasına orderId/metadata: biri unutulursa o olay geçmişte eksik kalır → uygulama checklist'i kapatır.
- Public sızıntı: kart bilinçli olarak yalnız detay component'inde; public path'lere eklenmez.

## Manuel QA
- Parça ekle→çıkar: iki satır, ad korunuyor, kim+saat doğru.
- İşçilik ekle, tahsilat oluştur/iptal, durum değiştir, meta güncelle, foto yükle, hasar işaretle → hepsi kartta.
- Public paylaşım linkinde log **YOK**.
- Farklı workshop'tan erişimde kayıt görünmüyor (tenant izolasyonu).

## Dosyalar
- `prisma/schema.prisma` (+migration)
- `src/lib/audit.ts`, `src/app/(app)/orders/actions.ts`, `src/app/(app)/cashbox/actions.ts`, `src/app/(app)/intakes/actions.ts`
- `src/lib/orders/activity.ts` (yeni)
- `src/components/app/order-activity-log.tsx` (yeni)
- `src/app/(app)/orders/[id]/page.tsx`, `src/components/app/work-order-detail.tsx`
