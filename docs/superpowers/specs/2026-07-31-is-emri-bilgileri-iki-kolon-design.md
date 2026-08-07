# İş Emri Bilgileri kartı: iki kolon + fatura, durum ve geliş nedeni

Tarih: 2026-07-31
Dal: `feat/order-info-invoice-fields`
Worktree: `/Users/void/www/bakimx-order-info`

## Problem

İş emri detayındaki "İş Emri Bilgileri" kartı tek kolon ve yalnız beş satır taşıyor
(İş No, Oluşturulma, Tahmini Teslim, Atanan Usta, Ödeme). Sağ taraf boş duruyor.
Servisin günlük işinde gereken üç bilgi hiç tutulmuyor:

- **Fatura numarası ve tarihi** — fatura entegrasyonu yok; kullanıcı kendi fatura
  uygulamasından okuyup elle girecek.
- **Servise geliş nedeni** — araç neden geldi (Arıza, Hasar, Bakım, Kontrol, Aksesuar).
- **Durum** — şu an yalnız başlıktaki akış butonlarından değişiyor; kartta doğrudan
  seçilebilen bir alan yok.

## Çözüm özeti

Kart md+ ekranda ikiye bölünür. Mevcut veriler sola yaslanır, sağ kolona beş yeni
alan gelir. `ServiceOrder`'a üç nullable kolon eklenir. Durum için yeni bir yazma
yolu açılmaz — mevcut, doğrulaması yapılmış durum aksiyonu kullanılır.

## 1. Kart düzeni

| Sol kolon (mevcut, davranış değişmiyor) | Sağ kolon (yeni) |
| --- | --- |
| İş No | Fatura Numarası |
| Oluşturulma | Fatura Tarihi |
| Tahmini Teslim | Toplam Tutar (salt okunur) |
| Tamamlanma (varsa) | Durum (dropdown) |
| Atanan Usta | Servise Geliş Nedeni (dropdown) |
| Teknisyen (eski, varsa) | |
| Notlar (varsa) | |
| Ödeme | |

- Grid: mobilde tek kolon (önce sol, sonra sağ), `md:` iki kolon.
- Sağ kolon `md:border-l md:pl-6` ile ayrılır; mobilde dikey çizgi yerine üst kenarlık.
- `OrderInfoCard` bugün 599 satırlık `src/components/orders/order-management-panel.tsx`
  içinde. Form ve iki dropdown eklenince orası şişer; bileşen kendi dosyasına taşınır:
  **`src/components/orders/order-info-card.tsx`**. Taşıma davranışı değiştirmez, yalnız
  `work-order-detail.tsx`'teki import satırı güncellenir.

### Düzenleme etkileşimi

- **Durum** ve **Geliş Nedeni**: dropdown'dan seçilince anında kaydeder, ardından
  `router.refresh()`. Tek dokunuş, mobil dostu.
- **Fatura No + Fatura Tarihi**: sağ kolondaki küçük "Düzenle" bağlantısıyla açılan
  Kaydet/İptal'li mini form. Satır içi kaydetme kullanılmaz — bu kod tabanında satır
  içi input'un odak kaybında sessizce eski değere dönme geçmişi var.
- **Toplam Tutar**: `totals.grandTotal` gösterilir, düzenlenemez. Hiçbir kalemde fiyat
  yoksa (`totals.hasAnyPrice === false`) `—` yazılır; sıfır lira gösterilmez. Fiyat halen
  "İndirim & KDV Düzenle" ve kalem satırlarından yönetilir.

## 2. Veri modeli

`ServiceOrder` modeline üç nullable kolon ve bir yeni enum eklenir:

```prisma
model ServiceOrder {
  // ...
  invoiceNo     String?
  invoiceDate   DateTime?
  arrivalReason ArrivalReason?
}

enum ArrivalReason {
  fault        // Arıza
  damage       // Hasar
  maintenance  // Bakım
  inspection   // Kontrol
  accessory    // Aksesuar
}
```

**Migration etkisi:** tamamen eklemeli. Üç kolon da nullable, veri taşıma ve backfill
yok, mevcut satırlar `null` kalır ve kartta `—` görünür. Kesinti gerektirmez, geri
alınabilir. Yerelde `db:migrate` ile üretilir, AWS dev'e tünelden `db:deploy` ile
uygulanır.

Etiketler tek yerde tanımlanır (`src/lib/constants.ts` → `ARRIVAL_REASONS`), veritabanı
değerleri İngilizce enum anahtarı olarak durur; mevcut `ORDER_STATUS` deseniyle aynı.

## 3. Sunucu tarafı

Üç alanın üçü de ayrı yazma yolundan geçer; hepsinde workshopId `requireWritableWorkshop()`
ile oturumdan türetilir, istemciden gelen hiçbir workshop parametresine güvenilmez.

### 3.1 Durum

**Yeni endpoint yok.** Mevcut `updateOrderStatusAction`
(`src/app/(app)/orders/actions.ts:728`) zaten:

- `isOrderStatus` ile değeri doğruluyor,
- `canTransitionOrder` ile yasa dışı sıçramayı reddediyor,
- `delivered` için fiyatsız kalem kontrolü yapıyor,
- bağlı intake statüsünü aynalıyor ve AuditLog yazıyor.

Dropdown yalnızca `ORDER_TRANSITIONS`'ın o durumdan izin verdiği hedefleri +
mevcut durumu listeler. **"Teslim Edildi" seçilirse durum doğrudan yazılmaz**,
`work-order-detail.tsx`'teki mevcut `handleRequestDeliveryOtp` akışı tetiklenir;
müşteri onaylı teslim zinciri korunur. Silme seçeneği hiçbir yerde yok; terminal
aksiyon "İptal".

Dropdown başlıktaki akış butonlarını kaldırmaz. İki yol da aynı sunucu doğrulamasından
geçtiği için bu kasıtlı bir tekrardır.

### 3.2 Fatura bilgisi

Yeni aksiyon: `updateOrderInvoiceAction(orderId, formData)`.

- Zod: `invoiceNo` trim + en fazla 50 karakter, boş → `null`; `invoiceDate` geçerli
  tarih ya da boş → `null`.
- **`isOrderLocked` kontrolünden muaf.** Fatura pratikte araç teslim edildikten sonra
  kesiliyor; teslim edilmiş iş emrinde kalem, fiyat, fotoğraf ve durum kilidi aynen
  sürerken yalnız bu iki alan yazılabilir kalır.
- **İptal edilmiş iş emrine fatura girilemez** — iş hiç yapılmadı.
- AuditLog: `order_invoice_updated`, `orderId` ve eski→yeni değerler metadata'da.
- `revalidatePath('/orders/[id]')`.

### 3.3 Geliş nedeni

Yeni aksiyon: `updateOrderArrivalReasonAction(orderId, reason)`.

- Değer `ArrivalReason` enum listesine karşı doğrulanır; boş değer temizleme sayılır.
- Fatura alanlarının aksine **`isOrderLocked` geçerlidir**: bu, işin içeriğine dair bir
  bilgi, teslim/iptal sonrası dondurulur.
- AuditLog: `order_arrival_reason_set`.

## 4. Yeni İş Emri sihirbazı

`src/components/intake/intake-wizard.tsx` Adım 3'te, "Müşteri Şikayeti" alanının altına
**opsiyonel** "Servise geliş nedeni" dropdown'ı eklenir. Şikayet zorunlu kalır, neden
zorunlu değildir — sahada akışı tıkamaması için.

Değer akışı: sihirbaz → `POST /api/intakes` → intake oluşturma aksiyonu →
`createServiceOrderForIntake(tx, workshopId, intakeFormId, arrivalReason?)`. Yardımcıya
opsiyonel dördüncü parametre eklenir; randevu ve teklif dönüşümündeki diğer iki
`serviceOrder.create` çağrısı değişmez (neden bilgisi orada toplanmıyor).

## 5. Kapsam dışı

- Fatura bilgisi ve geliş nedeni **müşteri PDF'inde ve public pasaportta gösterilmez**;
  v1'de dahili alanlardır. Yeni bir timeline olayı da üretilmez.
- Geliş nedenine göre raporlama, filtre veya analiz yok (veri birikince ayrı iş).
- Fatura entegrasyonu, fatura tutarının elle girilmesi, birden çok fatura yok.
- Geliş nedeni tek seçimdir; çoklu seçim yok.

## 6. Riskler

1. **Kilit muafiyeti.** Fatura alanları "teslim edilmiş iş emri dokunulmaz" kuralında
   bilinçli bir gedik açıyor. Karşı önlem: muafiyet yalnız iki alanla sınırlı, iptal
   edilmiş emirde geçerli değil ve her yazım denetim kaydına düşüyor.
2. **Çift durum yolu.** Başlık butonları + kart dropdown'ı aynı anda duruyor. İkisi de
   `updateOrderStatusAction`'a gittiği için tutarsızlık riski yok, ama UI tekrarı var.
3. **Yeni enum sızıntısı.** `ArrivalReason` müşteriye açık çıktılara eklenmiyor;
   `src/lib/intake/data-safety.ts` tarafında hiçbir alan genişletilmiyor.
4. **Bileşen taşıma.** `OrderInfoCard`'ın yeni dosyaya taşınması saf mekanik olmalı;
   aynı commit'te davranış değişikliği yapılmamalı ki gözden geçirme kolay kalsın.

## 7. Manuel QA

1. Mobil (375px) ve masaüstü (1440px) genişlikte kartın tek/iki kolon davranışı.
2. Fatura no + tarih gir, kaydet, sayfayı yenile → değerler duruyor.
3. Fatura no'yu boşalt, kaydet → `—` görünüyor.
4. Durum dropdown'ında yalnız izinli hedefler + İptal listeleniyor; silme yok.
5. `ready_for_delivery` durumunda "Teslim Edildi" seç → durum yazılmıyor, OTP akışı açılıyor.
6. Fiyatsız kalem varken teslim denemesi → sunucu reddediyor.
7. Teslim edilmiş iş emrinde: fatura alanları açık, durum ve neden dropdown'ları kilitli.
8. İptal edilmiş iş emrinde: fatura alanları da kilitli.
9. Yeni İş Emri sihirbazından neden seçmeden ilerle → kabul oluşuyor, neden boş.
10. Sihirbazdan neden seçerek ilerle → iş emri kartında seçili görünüyor.
11. Public paylaşım sayfası ve müşteri PDF'i → fatura ve neden hiçbir yerde yok.
12. Geçmiş sekmesi → fatura ve neden değişiklikleri işlem geçmişinde görünüyor.
