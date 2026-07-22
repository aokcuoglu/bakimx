# İş Emri "Parça & İşçilik" Sekmesi — Tecrübesiz Kullanıcı Sadeleştirmesi

**Tarih:** 2026-07-22
**Kapsam:** `/orders/[id]?tab=parca` sekmesinin tamamı (parça kartı + Fiyatlandırma + AI panel + sayfa düzeni). UI-only, migration yok.
**Ön koşul:** A–D maddeleri `feat/parca-iscilik-uc-sekme` dev'e merge olduktan sonra uygulanır (aynı dosyada ağır çakışma riski). E–G maddeleri o dalın dokunmadığı dosyalarda olduğundan beklemeden uygulanır.

## Amaç

Müşterilerdeki en tecrübesiz kullanıcının bile yardım almadan parça/işçilik ekleyip
toplamı görebilmesi. Paralel `feat/parca-iscilik-uc-sekme` işi (3 sekmeli composer +
tablo/kart redesign) korunur; bu iş onun ÇEVRESİNİ sadeleştirir.

## Kullanıcı onaylı kararlar

1. Kapsam: tüm sekme.
2. Model: 3 sekmeli composer aynen kalır, çevresi sadeleştirilir (radikal wizard yok).
3. Mobilde (<md) yapışkan Genel Toplam barı; dokununca Fiyatlandırma kartına kaydırır.
4. AI Danışman paneli kapalı (accordion) başlar; Premium kilidi içeride aynen kalır.
5. Etiket/jargon sadeleştirilir.

## Değişiklikler

### A. Etiket/jargon — `parts-labor-grid.tsx` *(merge sonrası)*
- "Katalogdan Parça" → "Araca Uygun Parça"; "Manuel Parça" → "Elle Parça Yaz".
- `PartPriceCompare` composer'da yazılı buton olur: "Fiyat Karşılaştır" (outline, sm);
  masaüstü tablo satırında ikon+tooltip kalır.
- Örnekli placeholder'lar: "Parça ara (ör. yağ filtresi)" / "Parça adı (ör. ön fren balatası)".
- Araç TecDoc'a bağlı değilse katalog sekmesinde tek satır yönlendirme:
  "Araç katalogla eşleşmedi — parçayı 'Elle Parça Yaz' sekmesinden ekleyebilirsiniz."

### B. Fiyat alanı doğrudan yazılabilir — `PriceField` *(merge sonrası)*
- Kalem-butonuna basıp input açma deseni kalkar; her zaman yazılabilir ₺ ön-ekli
  input (`InputGroup`, `inputMode="decimal"`). `useRowEditor.priceDraft/commitPrice`
  kuruş dönüşümü aynen; blur/Enter'da commit.

### C. Boş durum yönlendirmesi *(merge sonrası)*
- "Henüz kalem eklenmedi" → ikonlu, yönlendiren `EmptyItemsHint`: araç bağlıysa
  "Araca Uygun Parça sekmesiyle arayarak başlayın", değilse "Elle Parça Yaz…".
  Masaüstü tablo boş satırı + mobil boş paragraf aynı bileşeni kullanır.

### D. Kayıt geri bildirimi *(merge sonrası)*
- `persistUpdate` başarısında satırda 2 sn "✓ Kaydedildi" (yeşil, fade-out).
  `savedRowId` state + timeout; Desktop satırda sil butonunun yanı, mobil kart başlığı.

### E. Mobil yapışkan Genel Toplam barı — `work-order-detail.tsx` ✅
- `MobileTotalsBar`: parça sekmesi içeriğinin SON çocuğu, `sticky
  bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:hidden` — alt navigasyonun
  (fixed, <lg) üstünde yüzer, sekme sonunda doğal akışa oturur (içerik örtmez).
- "Genel Toplam ₺X · N kalem"; dokununca `pricingRef.scrollIntoView`.
- `totals.hasAnyPrice=false` iken gizli. Kilitli emirde de görünür (salt bilgi).

### F. AI Danışman kapalı başlar — `work-order-detail.tsx` ✅
- shadcn/Base UI Accordion; tetikleyici AI kart stilinde ince satır
  ("✨ AI Öneri Al", Premium yoksa kilit ikonu). İçerikte mevcut
  `ServiceAdvisorPanel` / `AdvisorPremiumLock` aynen.

### G. Fiyatlandırma kartı — `order-management-panel.tsx` ✅
- İndirim/KDV satırları yalnız değer >0 iken görünür (soluk "—" satırları kalktı).
- İkisi de sıfırken alt buton ghost "+ İndirim / KDV ekle"; doluysa outline
  "İndirim & KDV Düzenle" ("İskonto" jargonu bırakıldı).

## Dokunulmayanlar

Composer sekme yapısı, liste düzeni, API/şema/server action, `SourceBadge`,
`QtyStepper`, TecDoc picker, tedarikçi fiyat dialog içeriği (mock).

## Manuel QA

1. Mobil 390px: yapışkan bar görünür, dokununca Fiyatlandırma'ya kayar; alt nav ile çakışmaz.
2. AI panel kapalı başlar; açılınca eski içerik; premium olmayan hesapta kilit ikonu + upsell.
3. İndirim/KDV sıfır emirde "+ İndirim / KDV ekle"; kaydedince satırlar + "İndirim & KDV Düzenle".
4. Kilitli (delivered) emirde bar salt bilgi, düzenleme butonu yok.
5. (Merge sonrası A–D) yeni etiketler, doğrudan fiyat girişi, boş durum, ✓ Kaydedildi.
