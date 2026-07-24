# İş Emri Detay Başlığı — Sadeleştirme

**Tarih:** 2026-07-24
**Dal:** `feat/is-emri-baslik-sadelestirme` (base `dev` @ 86fd62d)

## Problem

İki değişiklik üst üste binince (PR #86 aksiyon butonlarını sticky dip bardan başlığa
taşıdı, PR #87 atanan usta rozetini başlığa ekledi) `DetailHeader` beş yarışan öğe
taşımaya başladı:

```
← [34 MHP 923]
  🚗 BMW 5 (F10) (2013)
  👤 MERVE ZİREK
  (Parça Bekliyor) (Ödenmedi) (+ Usta ata)
  [ Teslime Hazır ] [ ▶ Devam Et ]
```

Sorun sayı değil, **kategori karışması**: "Parça Bekliyor"/"Ödenmedi" okunacak *durum*,
"Usta ata" ise *aksiyon* ama rozet gibi duruyor; hemen altında iki gerçek buton var.
Üç farklı görsel ağırlık aynı alanda yarışıyor, hiyerarşi okunmuyor.

`NEXT_STATUSES`'a göre durum başına en fazla 2 aksiyon var, yani yukarıdaki en kötü hal.

## Hedef Düzen

```
← [34 MHP 923]
  🚗 BMW 5 (F10) (2013)
  👤 MERVE ZİREK   ·   🪖 Usta ata

  (Parça Bekliyor) (Ödenmedi)

  [ ▶ Devam Et ]  [⋯]        ⋯ → Teslime Hazır / İptal
```

Üç katman: **kimlik** (plaka, araç, müşteri, usta) → **durum** (okunacak rozetler) →
**aksiyon** (tek birincil buton + taşma menüsü).

## Kapsam Dışı

- Sticky/fixed dip aksiyon barı geri getirmek (PR #86 konvansiyonu: eklenmeyecek).
- İş emri listesi ve `OrderInfoCard` görünümü — `TechnicianAssign` varsayılan `pill`
  varyantıyla oralarda aynen kalır.
- `NEXT_STATUSES` içeriğini veya durum geçiş kurallarını değiştirmek.

## Değişiklikler

### 1. `src/lib/orders/header-actions.ts` (yeni)

Saf, test edilebilir bölme mantığı:

```ts
splitHeaderActions(actions) -> { primary: Action | null, overflow: Action[] }
```

- `primary`: `tone === "primary"` olan ilk aksiyon; yoksa `null`.
- `overflow`: kalanlar; `secondary` olanlar önce, `danger` olanlar sonda
  (menüde ayırıcının altına konur).
- Girdi dizisi mutasyona uğratılmaz.

Davranış tablosu (`NEXT_STATUSES` üzerinden):

| Durum | primary | overflow |
|---|---|---|
| `draft` | Başla | — |
| `waiting_approval` | Başla | İptal |
| `approved` | Başla | Parça Bekliyor |
| `in_progress` | Teslime Hazır | Parça Bekliyor |
| `waiting_parts` | Devam Et | Teslime Hazır |
| `ready_for_delivery` | Teslim Et (OTP) | İptal |
| `delivered` | — | — |
| `cancelled` | Yeniden Aktif Et | — |

### 2. `DetailHeader`

- Yeni opsiyonel prop `meta?: ReactNode` — müşteri satırının yanına, kimlik bloğunun
  parçası olarak render edilir.
- Aksiyonlar `splitHeaderActions` ile bölünür: `primary` buton olarak; `overflow`
  varsa `⋯` dropdown olarak (`aria-label="Diğer işlemler"`).
- `overflow` boşsa `⋯` **render edilmez**; `primary` yoksa buton render edilmez;
  ikisi de boşsa aksiyon alanı hiç çıkmaz.
- `danger` tonundaki menü öğesi ayırıcının altında ve destructive renkte.
- Mevcut `TONE_ORDER` sıralaması `splitHeaderActions` ile yer değiştirir.

### 3. `TechnicianAssign` — `variant` prop'u

- `variant="pill"` (varsayılan): bugünkü rozet. `OrderInfoCard` ve `order-list`
  değişmez.
- `variant="meta"`: kimlik satırının dili — ikon + metin, `text-muted-foreground`,
  hover'da `text-primary`. Rozet çerçevesi/dolgusu yok. Kilitli emirde tıklanmaz metin.

### 4. `work-order-detail`

`DetailHeader`'a `meta={<TechnicianAssign variant="meta" ... />}` geçirir; rozet
`badges` slotundan çıkarılır.

## Test

- `src/lib/orders/header-actions.test.ts` — yukarıdaki 8 durumun tamamı + girdi
  mutasyona uğramıyor kontrolü.
- Mevcut 337 test geçmeye devam etmeli.
- Elle QA: aşağıdaki adımlar.

## Risk Alanları

- **Keşfedilebilirlik:** `waiting_parts` durumunda "Teslime Hazır" menüye iniyor.
  Parça bekleyen araç doğrudan teslime hazır hale geliyorsa bu bir ekstra dokunuş.
  Bilinçli kabul; kullanımda rahatsız ederse `NEXT_STATUSES` sıralaması gözden geçirilir.
- Base UI `Menu` (⋯) ile `BottomSheet` (usta ataması) aynı sayfada — portal/z-index
  çakışması kontrol edilmeli.
- `DetailHeader`'ın tek tüketicisi var (`work-order-detail`), bu yüzden yapı değişikliği
  düşük riskli.

## Manuel QA

1. 390px'te iş emri detayı: kimlik / rozet / aksiyon üç ayrı katman, yatay kaydırma yok.
2. Her durum için başlık: `draft` (tek buton, ⋯ yok), `in_progress` (buton + ⋯),
   `waiting_parts` (Devam Et + ⋯'da Teslime Hazır), `ready_for_delivery`
   (Teslim Et + ⋯'da İptal), `delivered` (aksiyon yok), `cancelled` (tek buton).
3. ⋯ menüsünden ikincil geçiş çalışıyor; İptal destructive görünüyor.
4. Meta satırındaki usta tıklanınca atama sheet'i açılıyor; ⋯ menüsü açıkken çakışma yok.
5. Teslim edilmiş emirde usta salt-okunur.
6. İş emri listesi ve "İş Emri Bilgileri" kartındaki usta rozeti **değişmemiş** olmalı.
