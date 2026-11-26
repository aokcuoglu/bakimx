# Araç kabulü detayı — tek sayfa + yan ray (tasarım)

- **Karar:** kullanıcı, 25-11-2026 ("Tek sayfa + yan ray" seçeneği)
- **Issue'lar:** #911 (1/3 iskelet), #912 (2/3 tekrarlar), #913 (3/3 durum ve cilalar)
- **Kaynak:** UI incelemesi (bakimx-ui-ux, 25-11, localhost:3001) + sektör araştırması (aşağıda kaynaklar)

## 1. Neden

Bugün `/orders/[id]` altı sekmeli bir kayıt sayfası:
Özet · Parça & İşçilik · Tahsilat · Kanıt · Teknisyen · Geçmiş.

İnceleme bulguları:

- **Telefonda ilk ekran.** Kimlik, haplar, birincil düğme, hızlı işlem satırı ve tutar şeridi ~730px tutuyor. Şikâyet, kalan bakiye ve sıradaki adım ilk ekranda yok. Danışmanın ilk sorusu "müşteri ne dedi?"; bu bilgi Özet'te üçüncü kartta.
- **Altı sekme tek bir iş akışını bölüyor.** Akış kabul → iş → parça/işçilik → ödeme → teslim. Telefonda Kanıt, Teknisyen ve Geçmiş sekmeleri ekran dışında, kaydırılabildiğine dair işaret yok. Tahsilat sekmesi neredeyse boş.
- **Tekrar.**
  - Para dört yerde: tutar şeridi, Özet "Toplam Tutar", Tahsilat'ta iki ayrı blok, Parça'daki `MobileTotalsBar`.
  - "Parça ekle / İşçilik ekle" iki yerde.
  - Bilgi kartları başlığı tekrarlıyor.

Araştırma:

- NN/g'ye göre sekmeler, birlikte görülmesi gereken bilgiyi ayırınca kısa süreli belleği zorluyor; sekme ne kadar azsa o kadar iyi.
- Shopmonkey ana alanı servis kartlarına, sağdaki yan paneli toplam, ödeme, onay ve aktiviteye ayırıyor.
- Jobber ve Shop-Ware tek sayfa kullanıyor ve aşamaya göre değişen tek birincil düğme koyuyor.
- Tekmetric kullanıcıları "araç bilgisi için sekmeye dönmek zorundayım" diye şikâyet ediyor.

## 2. Hedefler / hedef dışı

**Hedef:** Danışman bir bakışta şunları görür: kim/ne, ne şikâyet edildi, durum ve sıradaki adım, ne yapıldı, ne kadar alacak var. İş akışı sekme atlamadan tek kaydırmada ilerler. Masaüstünde ana iş solda, bağlam sağdaki yapışkan rayda.

**Hedef dışı:**
- Teknisyen paneli (`/technician/orders/[id]`).
- Teklif editörü.
- Veri, action ve şema değişikliği.
- Yeni iş özelliği (müşteri onayı, DVI aciliyet renkleri vb.); bunlar ayrı issue.

**Anti-hedef:** Uzun ve yavaş bir sayfa. Tüm bölümler aynı anda çizildiği için ağır bölümler (Kanıt, Geçmiş) tembel ya da daraltılmış gelmeli.

## 3. Yerleşim

> **Uygulama notu (#911):** kolon geçişi görünüm alanına (`lg`) değil içerik genişliğine bağlıdır (`@container detail`: ≥780px iki kolon + 300px ray, ≥1040px ray 340px, altında tek kolon + çipler), ve çip sayısı altıdır: Özet · Kalemler · Kanıt · Ödeme · **Teknisyen** · Geçmiş.

### Masaüstü (lg, ≥1024px)

```
┌─ Başlık: plaka · araç · müşteri · durum hapları ── [birincil] ⋯ ┐
│  hızlı işlemler (Parça · İşçilik · Fotoğraf · Tahsilat)          │
├──────────────────────────────────────┬──────────────────────────┤
│ ANA KOLON (minmax(0,1fr))             │ RAY (340px, yapışkan)    │
│  1 Şikayet & Notlar                   │  Durum + sıradaki adım   │
│  2 Kalemler (Talepler + Parçalar)     │  Ödeme (kalan, tahsilat) │
│  3 Kanıt (Fotoğraflar, Hasar)         │  Müşteri & Araç          │
│  4 Kabul bilgileri                    │  Teknisyen (x/y, aç ›)   │
│  5 Ödemeler (tahsilat geçmişi)        │  Müşteri bağlantısı      │
│  6 Teknisyen (salt okunur ayrıntı)    │                          │
│  7 Geçmiş (son 5, "tümünü göster")    │                          │
└──────────────────────────────────────┴──────────────────────────┘
```

- **Ray:** `position: sticky; top: <üst bar + 16px>`. Kendi yüksekliği görünür alanı aşarsa ray kendi içinde değil, sayfayla birlikte kayar; yalnız üst kısmı yapışır, `max-height` ile iç kaydırma yapılmaz.
- **Bölüm başlıkları:** `DetailPanel` dili korunur: kartın dışında kalın başlık, çerçevesiz beyaz kart. Bölümler arası ritim `detail.stack`.
- **1024–1279px arası:** ray 300px. Ana kolon dar kalırsa kalem tablosu kart düzenine düşer; bu, #849 ve #873'ün kapsayıcı bandı ile zaten çözülü.

### Telefon ve tablet (<lg)

```
Başlık (kimlik + haplar + birincil + ⋯)
Hızlı işlemler
┌ Özet kartı ──────────────────────────┐
│ Şikâyet (2 satır, "devamı")          │
│ Kalan ₺… · [Tahsilat al]             │
│ Sıradaki adım / engel (varsa)        │
└──────────────────────────────────────┘
[Özet][Kalemler][Kanıt][Ödeme][Geçmiş]  ← yapışkan bölüm çipleri
Bölümler tek kolonda; ray kartları akışta:
 Özet bölümü = Şikayet & Notlar + Müşteri & Araç + Kabul bilgileri
 Kalemler · Kanıt · Ödeme (ödeme kartı + geçmiş) · Teknisyen · Geçmiş
```

- **Çipler:** üst barın altında yapışkan. Dokununca ilgili bölüme kaydırır (`scroll-margin-top` = üst bar + çip şeridi). Kaydırırken etkin çip güncellenir (IntersectionObserver).
- **Çip şeridi:** yatay kayar, etkin çip görünür alana getirilir; bunun mantığı #848'den hazır.
- **`MobileTotalsBar` kalkar:** özet kartı ve "Ödeme" çipi aynı işi görüyor. 2/3'te kesinleşir; 1/3'te davranışı korunarak bölüme kaydırmaya çevrilir.

## 4. Gezinme sözleşmesi

- **`?tab=` geriye uyum.** `?tab=<key>` (ozet, parca, tahsilat, kanit, teknisyen, gecmis) bölüm kimliğine eşlenir ve sayfa açılınca o bölüme kaydırır. Liste, bildirim ve uyarı bağlantıları kırılmaz.
  - Eşleme: `parca → kalemler`, `tahsilat → odeme`, `kanit → kanit`, `teknisyen → teknisyen`, `gecmis → gecmis`, `ozet → ust`.
  - Kaydırma sonrası URL hash'e (`#kanit`) çevrilebilir; sunucuya uğramaz.
- **`?edit=1` aynen:** Şikayet düzenleme diyaloğu açılır.
- **Atlamalar.** Eksik açı çipi → Kanıt; toplam → Ödeme; "Parça sekmesinde karar ver" / "tamamla" → Kalemler. Hepsi bölüme kaydırır.
  - #838'in `usePendingScroll` mekanizması sekme mount gecikmesi için vardı; sekme kalkınca bölüm zaten mount'ta, doğrudan `scrollIntoView` yeter.
  - Fotoğraf diyaloğunun açılması (`focusPhoto`) aynen korunur.
- **Klavye.** Çipler `nav aria-label="Bölümler"` içinde bağlantı listesi (`<a href="#kanit">`), sekme rolü değil. Odak bölüm başlığına taşınır.

## 5. Bileşen eşlemesi (1/3, içerik olduğu gibi taşınır)

| Bugün | 1/3 sonrası |
|---|---|
| Özet: Yeniden Aç notu | Ana kolon başı (teslim edilmiş kabulde) |
| Özet: `OrderRecordRail` "Kayıt" | Ray: Müşteri & Araç kartı (telefonda Özet bölümünde) |
| Özet: `OrderInfoCard` | Ana kolon 4 "Kabul bilgileri" (2/3'te sadeleşir) |
| Özet: Şikayet & Notlar | Ana kolon 1 |
| Özet: Kabul kanıtları özeti | Kanıt bölümünün başı |
| Özet: Fiyatlandırma (`PricingSummaryCard`) | Ray: Ödeme kartı (2/3'te tutar şeridi ve Ödeme Özeti ile birleşir) |
| Özet: Müşteri Çıktısı | Ray: Müşteri bağlantısı (telefonda Ödeme'nin altında) |
| Parça: `PartsRequestPanel` + `PartsLaborCard` | Ana kolon 2 "Kalemler" |
| Tahsilat: Ödeme Özeti + `PaymentHistoryCard` | Ana kolon 5 "Ödemeler" (özet 2/3'te raya) |
| Kanıt: Fotoğraflar + Hasar | Ana kolon 3 |
| Teknisyen: bağlam kartı (#897) | Ray: Teknisyen kartı |
| Teknisyen: `TechnicianProgressPanel` | Ana kolon 6 |
| Geçmiş: `OrderActivityLog` | Ana kolon 7 (ilk 5 kayıt, genişlet) |
| Tutar şeridi | 1/3'te kalır; 2/3'te Ödeme kartına katılır |
| Uyarı şeritleri (fiyatsız kalem, karar bekleyen talep) | 1/3'te başlık altında kalır; 3/3'te Durum kartına |
| Hızlı işlemler (#881) | Aynen kalır; davranışı bölüme kaydırma ya da diyalog açma |

**Kilitli sekmeler.** Lite'ta `cashbox`/`team` kapalıysa ilgili bölümün yerinde `InlineFeatureUpsell` durur. Bugün sekmede kilit simgesi var; bölüm başlığı + yükseltme kutusu aynı işi görür.

## 6. Performans

- **Kanıt:** fotoğraf küçük resimleri zaten blob ile tembel geliyor. 3B görüntüleyici görünür olana kadar yüklenmemeli (IntersectionObserver ya da mevcut tembel yükleme).
- **Geçmiş:** ilk 5 kayıt.
- Sunucu sorgusu değişmez (`page.tsx` zaten her şeyi tek seferde çekiyor).

## 7. Dilimler

1. **#911 iskelet.**
   - Sekmeler kalkar; bölümler, ray ve çipler gelir.
   - `?tab=` eşlemesi; atlamalar bölüme.
   - İçerik bileşenleri dokunulmadan taşınır.
   - Testler güncellenir (`work-order-detail.test.ts`, `order-detail-tabs.test.ts`, `photo-entitlement.test.ts`, `pending-scroll` testleri, `tabs-overflow`).
2. **#912 tekrarlar.**
   - Ödeme kartı tek yer: tutar şeridi, Fiyatlandırma, Ödeme Özeti ve `MobileTotalsBar` buraya.
   - Kabul bilgileri sadeleşir; Durum Select'i karttan çıkar.
   - Mükerrer ekleme düğmeleri kalkar.

   > **Uygulama notu (#912):**
   > - **Para tek kartta.** Raydaki "Ödeme Özeti" kartı (telefonda Ödeme bölümünün başı): zincir (Ara Toplam · İndirim · KDV) indirim ya da KDV varken hep görünür, sonra Genel Toplam, Tahsil Edilen, Kalan. Parça / İşçilik / Dış İşçilik dökümü açılır satırda. "Tahsilat al" ve "İndirim / KDV" bu kartta. Tutar şeridi, Ödemeler'deki ikinci özet, tahsilat geçmişinin toplam bloğu ve `MobileTotalsBar` kalktı. Tahsilat geçmişi yalnız liste; "İptal Edilen" toplamı yok, iptal satırı üstü çizili ve "İptal" haplı.
   > - **Tahsil edilen: tek etiket, tek kaynak.** Etiket "Tahsil Edilen" ("Ödenen" kalktı). Kaynak `orderPaidKurus` (`src/lib/cashbox/status.ts`): kasa açıkken tamamlanmış tahsilatların toplamı (defter), değilse `ServiceOrder.paidAmount` önbelleği. Eski `paidAmount || defter` önbellek 0'dan büyükken defteri hiç görmüyordu. KDV etiketi belgenin gerçek oranını yazar (`orderTotalsChain`); türetilmiş oran kısmi KDV'li belgede yanlıştı.
   > - **Telefon özet kartı.** Para satırı düğme değil, Ödeme bölümüne bağlantı: "Kalan ₺…" (kasa yoksa "Genel Toplam ₺…"), altında Genel Toplam ve zincir. Kalemler'de telefon toplamı yok; #913'te yeniden bakılır.
   > - **Durum yalnız başlıktan.** Kabul bilgileri kartından Durum, Atanan Usta, Ödeme ve Toplam Tutar satırları kalktı (Lite'ta usta satırı da yok). Başlık haritası (`NEXT_STATUSES`) durum makinesinin her hedefini sunar; `header-actions.test.ts` her durum için `orderStatusOptions(s).slice(1)` ile eşitliği sınar. İptal her durumda onay penceresi açar.
   >
   >   | Durum | Birincil | ⋯ menüsü |
   >   |---|---|---|
   >   | Taslak | Başla | İptal |
   >   | Onay bekliyor (eski) | Başla | İptal |
   >   | Onaylandı (eski) | Başla | Parça Bekliyor · İptal |
   >   | İşlemde | Teslime Hazır | Parça Bekliyor · İptal |
   >   | Parça bekliyor | Devam Et | Teslime Hazır · İptal |
   >   | Teslime hazır | Teslim Et (OTP) | İşleme Geri Al · İptal |
   >   | Teslim edildi | — | — (yönetici: "Yeniden Aç" notu) |
   >   | İptal | Yeniden Aktif Et | — |
   > - **Ekleme ilkesi.** Bir eylemin sayfada tek görünür girişi olur. Hızlı işlem satırı (#881) birincil yoldur; bölüm başlığındaki ikon menü ("Kalem ekle") uzun sayfada bölümün içinden aynı pencereyi açar. Grid araç çubuğu iş emri kabuğunda gizli (teklif ve teknisyen ekranında durur). Teslim kodu yalnız başlıktaki "Teslim Et (OTP)" ile istenir; Müşteri Çıktısı'ndaki ikinci düğme fiyat ve parça kararı kapısını atlıyordu.
3. **#913 durum ve cilalar.**
   - Durum kartında sıradaki adım ve engeller.
   - Teslim edilmiş kabul görünümü.
   - Tablo kırpılması ve adımlayıcı.
   - Mobil iki satırlık kalem satırı.
   - Geçmiş gruplaması.

## 8. Riskler

- **Kaynak tarayan testler** sekme yapısını sabitliyor (`TabsContent value=…`, `focusPhoto … return (` sınırı, `{!orderLocked && canUsePhotoChecklist && (<>` literali). Her biri ya korunur ya da gerekçesiyle güncellenir; zayıflatılmaz.
- **Paralel işler:** #888 (form kontrolleri), #920 (iç içe köşe dilimleri). `work-order-detail.tsx`'e dokunan açık iş olmamalı; başlamadan `git worktree list` ve açık PR'lar kontrol edilir.
- **Sayfa uzunluğu:** ray masaüstünde bağlamı sabit tutar; telefonda çipler atlamayı sağlar. Bölümlerin kendi içinde daraltma (Geçmiş, Teknisyen ayrıntısı) gerekir.

## Kaynaklar

- NN/g — Tabs, Used Right: https://www.nngroup.com/articles/tabs-used-right/
- NN/g — Content Dispersion: https://www.nngroup.com/articles/content-dispersion/
- NN/g — In-page links: https://www.nngroup.com/articles/in-page-links-content-navigation/
- NN/g — Sticky headers: https://www.nngroup.com/articles/sticky-headers/
- Shopmonkey — servis kartları: https://support.shopmonkey.io/hc/en-us/articles/38745363739156
- Shop-Ware — iş emri: https://support.shop-ware.com/s/article/Getting-Started-Work-Orders
- Jobber — iş sayfası: https://help.getjobber.com/en/articles/job-basics/
- Tekmetric — G2 yorumu: https://www.g2.com/survey_responses/tekmetric-review-7695612
- Attio — kayıt sayfası yeniden tasarımı: https://attio.com/changelog/2026/record-page-redesign
