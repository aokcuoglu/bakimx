# BakımX açık zemin denemesi — #635

Kapsam: yalnız ana sayfa giriş ve ürün turu. Yerel karşılaştırma; PR, merge ve yayın yok. Başlangıç: origin/dev, 8e8ee8f0. Cal.com planın düzen referansıdır; tasarım BakımX bileşenleri ve mevcut varlıklarıyla uygulanır.

## Tipografi ve ritim

Mevcut Geist korunur. Tek H1: mobil 36px, tablet 48px, masaüstü 56px; satır yüksekliği 1.08, harf aralığı -0.045em. Ürün turu H2: 30/36/44px. Gövde 16px/28px, panel metni 14px/24px. Etiketler 12px. İçerik en fazla 1280px; kenar boşluğu 20/32px. Bölümler 48/64/80px dikey boşluk kullanır.

## Renk ve yüzey

Açık ana zemin `background`, paneller `card`, görsel alanı `muted`. Başlık `navy`, vurgu ve onay ikonları `primary`, açıklamalar `muted-foreground`. İnce `border` çizgileri ve 16px panel köşeleri kullanılır. Seçili sekme `navy` / `navy-foreground`. Renkler yalnız tema tokenlarıdır; global tema değişmez.

## Giriş ve görseller

1024px üzerinde metin solda, ürün paneli sağda; altında doğal belge sırası metin, CTA, sekmeler, görseldir. İlk mesaj, fiyat metni, CTA hedefleri ve analitik olayları korunur. Üç Radix sekmesi otomatik geçiş yapmaz. İlk panel ruhsatın tamamını sabit demo bilgileriyle eşleştirir; diğerleri mevcut katalog ve iş emri ekranlarının yakın görünümüdür. Her panel örnek gösterim olarak işaretlidir. Ruhsat bilgileri canlı OCR çıktısı gibi sunulmaz. Sabit görsel yüksekliği yüklenme sıçramasını engeller.

## Ürün turu ve mobil

İş emri / Araç kabul / Müşteri takibi korunur. Mobil sıra: başlık ve açıklama, görsel, maddeler, örnek kayıt açıklaması. 320px üzerinde üç sekme tek satıra sığar; CTA'lar küçük ekranlarda tam genişliktedir. Ekran görüntüleri seçili ilgili alanı gösterir, uzun ekranların tamamını küçültmeye çalışmaz.

## Etkileşim ve erişilebilirlik

Radix Tabs ok tuşları, Home/End ve Tab ile çalışır; seçili durum ile klavye odağı görünürdür. Button kompozisyonu asChild kullanır. İlk içerik sunucu HTML'inde görünür; animasyon ve framer-motion yok. Görsel alanlarının ölçüsü önceden ayrılır. Kontrast ve taşma 320, 390, 768, 1440px genişliklerde doğrulanır. Kayıt dönüşümüne etki bu deneyde ölçülmez.
