# Kapanmış İş Emri Tam Kilit — Tasarım

**Tarih:** 2026-07-12
**Durum:** Onaylandı (kullanıcı, sohbet içinde)

## Problem

`delivered` (teslim edildi) statüsündeki bir iş emrinde parça/işçilik kalemleri, fiyat,
teknisyen ataması ve checklist kilitleniyor (`isOrderLocked`, `src/lib/status-transitions.ts`),
ancak üç yüzey açık kalıyor:

1. **İş emri bilgileri düzenleme** (müşteri şikayeti, iç not, km) — `updateIntakeDetailsAction`
   statü kontrolü yapmıyor; teslim sonrası da audit-log'lu düzenlemeye izin veriyor.
2. **Fotoğraf ve hasar işareti ekleme** — `addPhotoAction` / `addDamageMarkAction` statü
   kontrolü yapmıyor; teslim sonrası kanıt eklenebiliyor.
3. **Tahsilat** — `createCollectionAction` yalnızca `cancelled` iş emrini reddediyor;
   teslim edilmiş **ve tamamen ödenmiş** iş emrine yeni tahsilat eklenebiliyor
   (yanlışlıkla mükerrer tahsilat → `overpaid`).

Kullanıcı kararı: üç yüzey de kilitlenecek.

## Kapsam ve kurallar

Kilit tanımı mevcut haliyle kalır: `isOrderLocked(status)` = `delivered || cancelled`.
İptal edilen iş emri `draft`'a döndürülürse kilit açılır (mevcut davranış, değişmiyor).

| Yüzey | Kilit koşulu | Davranış |
|---|---|---|
| Bilgi düzenleme (şikayet/not/km) | order `delivered`/`cancelled` VEYA intake `delivered`/`cancelled` | Sunucu aksiyonu hata döner; UI'da düzenle butonu gizlenir |
| Fotoğraf ekleme | aynı | Sunucu aksiyonu hata döner; UI yükleme alanı salt-görüntü |
| Hasar işareti ekleme | aynı | Sunucu aksiyonu hata döner; UI ekleme kapalı |
| Tahsilat | order `delivered` VE `paymentStatus ∈ {paid, overpaid}` | Sunucu aksiyonu hata döner; "Tahsilat Ekle" butonları gizlenir |

Önemli ayrım: **teslim edilmiş ama borcu kalan** iş emrine tahsilat AÇIK kalır
(araç gitti, ödeme sonra senaryosu). `paymentStatus` her tahsilat yazımında recalc
edildiği için güvenilir kaynaktır.

Bağlı order'ı olmayan intake'lerde (varsa) intake statüsü tek başına belirleyicidir.

## Değişecek noktalar

**Sunucu (asıl güvenlik katmanı):**
- `src/app/(app)/intakes/actions.ts` — `updateIntakeDetailsAction`, `addPhotoAction`,
  `addDamageMarkAction`: intake sorgusuna `order` (status) dahil edilir; kilitliyse
  Türkçe hata mesajıyla reddedilir. `/api/intakes/photos` bu aksiyonlara delege
  ettiği için otomatik kapsanır.
- `src/app/(app)/cashbox/actions.ts` — `createCollectionAction`: mevcut `cancelled`
  kontrolünün yanına `delivered && (paid || overpaid)` reddi eklenir.

**UI (yüzey gizleme, güvenlik değil):**
- İş emri detayında (WorkOrderDetail ve alt bileşenleri) bilgi düzenle / foto yükle /
  hasar ekle aksiyonları `locked` iken gizlenir veya salt-görüntü olur.
- `order-management-panel.tsx` "Tahsilat Ekle" butonları `delivered && paid/overpaid`
  iken gizlenir.
- Tahsilat formunun iş emri dropdown'ı tam ödenmişleri zaten listelemiyor (değişiklik yok).

**Şema değişikliği yok. Migration yok.**

## Test

- Guard'ların birim testleri (`status-transitions.test.ts` desenine uygun; saf yardımcı
  fonksiyona çıkarılan koşullar test edilir).
- Manuel QA: teslim+ödenmiş iş emrinde üç yüzeyin de kapalı olduğu; teslim+borçlu
  iş emrinde tahsilatın açık kaldığı; `in_progress` iş emrinde her şeyin eskisi gibi
  çalıştığı.

## Riskler

- Teslim sonrası yazım hatası düzeltme imkânı kalkıyor (bilinçli karar).
- Teslim sonrası kanıt fotoğrafı ekleme kalkıyor — teslim anına kadar eklenmeli
  (bilinçli karar).
- Eski kayıtlar: hâlihazırda `delivered` olan iş emirleri anında kilitlenir; veri
  değişikliği gerekmez.
