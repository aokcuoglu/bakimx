# Güvenlik Politikası

## Açık bildirimi
Bir güvenlik açığı tespit ederseniz **herkese açık issue açmayın**. Lütfen doğrudan ekibe ulaşın: security@bakimx.com (veya repo sahibine özel mesaj). Makul bir sürede dönüş yapılır.

## Kapsam
- Tenant/workshop veri izolasyonu
- Kimlik doğrulama & oturum yönetimi (iron-session)
- Public paylaşım linkleri / PDF çıktıları (`/s/[token]`, `/p/[token]`)
- OTP onay & teslim akışları
- Cron uçları (`CRON_SECRET` ile korunur)

## Desteklenen sürüm
Yalnızca `main` üzerindeki en güncel üretim sürümü desteklenir.
