# Kesinti iletişimi (interim, BAK-119)

**Durum:** BAK-119 Seçenek 3 ile teslim edildi — ücretsiz, dakikalar içinde
kurulan bir kanal. Dahili `/status` sayfası (Seçenek 2) ayrı bir alt-issue
olarak backlog'da: BAK-128, portföy büyüdükçe ele alınacak.

## Kanal

- **Hesap:** [x.com/bakimxcom](https://x.com/bakimxcom)
- **Yöneten:** kurumsal `hey@bakimx.com` — hesaba erişimi olan kişi bu kutuyu
  kontrol eder.
- Hesap linki `www.bakimx.com` footer'ında (`src/components/sections/Footer.tsx`)
  LinkedIn/Instagram ile birlikte listelenir.

## Ne zaman kullanılır

Müşteri-görünür bir kesinti/degradasyon (uygulama erişilemiyor, ödeme akışı
çalışmıyor, veri kaybı riski vb.) başladığında ve olay 15 dakikadan uzun
sürmesi bekleniyorsa. Kısa, kendiliğinden düzelen kesintiler için (ör. tek bir
istek zaman aşımı) gerekmez.

## Hazır şablonlar

Kesinti tespit edildiğinde `hey@bakimx.com` erişimi olan kişi aşağıdaki
şablonlardan uygun olanı paylaşır; köşeli parantezleri doldurur.

**Kesinti başlangıcı**
```
⚠️ Şu an [uygulama / ödeme / ...] tarafında bir kesinti yaşıyoruz.
Ekibimiz sorunu araştırıyor. Gelişmeleri buradan paylaşacağız.
```

**Güncelleme (devam eden kesinti)**
```
Güncelleme: [kısa durum]. Tahmini çözüm süresi: [varsa süre / "belirsiz"].
```

**Çözüldü**
```
✅ [Kısa özet] sorunu çözüldü, sistemler normal çalışıyor.
Yaşadığınız aksaklık için özür dileriz.
```

## Sınır

Bu bir gerçek-zamanlı statü sayfası değil — geçmiş olay arşivi tutmaz, yalnız
o anki bildirimi yapar. Geçmiş olay listesi ve yönetici konsolundan güncelleme
yayınlama BAK-128'in kapsamındadır.
