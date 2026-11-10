# Tarayıcı sekme başlıkları — #642

Takip: https://github.com/aokcuoglu/bakimx/issues/642

## Karar

Sayfa adı önce, marka sonda: `Sayfa adı | BakımX`. Ana sayfa markayı tanıtır: `BakımX: Oto Servis Yönetim Platformu`. Yönetim konsolunda `Sayfa adı · Yönetim | BakımX` kullanılır. Blog listesi marka ile başlar: `BakımX Blog: Servis Yönetimi ve Rehberler`; makaleler kendi yazı başlığını kullanır. Kelimeler otomatik kesilmez; uzun public başlıklar editoryal olarak kısaltılmıştır.

Başlıklar Next.js sunucu metadata API'sinde tanımlıdır. `src/lib/seo.ts` marka, root şablonu ve sosyal paylaşım biçimini tutar. `(app)` ve `admin` layout'ları çocukları için şablonu tekrar tanımlar: yalın layout başlığı torun sayfalarda root şablonunu kaybettiriyordu. İsim, plaka, token veya ek veritabanı sorgusu eklenmez; detay sayfaları ekranın amacını belirtir. Canonical ve robots politikası korunur. PWA adları aynı marka yazımını kullanır.

Yönlendirme sayfaları hedefin başlığını alır. Filtre, sıralama, modal ve sayfa içi sekmeler yeni sayfa başlığı üretmez. Hata sınırları bu metadata politikasından ayrı mevcut davranışlarını sürdürür.

## Sayfa envanteri

120 `page.tsx` dosyası değerlendirildi. Aşağıdaki liste tüm rotaları kapsar; blog yazı rotası her mevcut yazı için tarayıcıda ayrıca doğrulanır.

| Rota | Sekme başlığı |
| --- | --- |
| `/account` | Yönlendirme hedefinin başlığı |
| `/account/billing` | Yönlendirme hedefinin başlığı |
| `/account/plans` | Yönlendirme hedefinin başlığı |
| `/analytics` | Servis Analizi \| BakımX |
| `/appointments/[id]` | Randevu Detayı \| BakımX |
| `/appointments/new` | Yeni Randevu \| BakımX |
| `/appointments` | Randevular \| BakımX |
| `/bakimx-orders` | Parça Siparişlerim \| BakımX |
| `/billing` | Paketler ve Kullanım \| BakımX |
| `/billing/quota` | Yönlendirme hedefinin başlığı |
| `/billing/quota/purchase` | Ek Kota Satın Al \| BakımX |
| `/calendar` | Takvim \| BakımX |
| `/cash` | Yönlendirme hedefinin başlığı |
| `/cashbox/aging` | Alacak Yaşlandırma \| BakımX |
| `/cashbox` | Kasa \| BakımX |
| `/cashbox/payments/[id]` | Ödeme Detayı \| BakımX |
| `/cashbox/payments/new` | Yeni Ödeme \| BakımX |
| `/cashbox/payments` | Ödemeler \| BakımX |
| `/communications` | İletişim Merkezi \| BakımX |
| `/customers/[id]` | Müşteri Detayı \| BakımX |
| `/customers/balances` | Müşteri Bakiyeleri \| BakımX |
| `/customers/new` | Yeni Müşteri \| BakımX |
| `/customers` | Müşteriler \| BakımX |
| `/dashboard` | Genel Bakış \| BakımX |
| `/inventory` | Yönlendirme hedefinin başlığı |
| `/onboarding` | İş Yeri Kurulumu \| BakımX |
| `/orders/[id]` | İş Emri Detayı \| BakımX |
| `/orders/new` | Yeni İş Emri \| BakımX |
| `/orders` | İş Emirleri \| BakımX |
| `/parts/[id]/edit` | Stok ve Hizmet Düzenle \| BakımX |
| `/parts/[id]` | Stok ve Hizmet Detayı \| BakımX |
| `/parts/new` | Yeni Stok veya Hizmet \| BakımX |
| `/parts` | Stok ve Hizmetler \| BakımX |
| `/purchases` | Dış Alımlar \| BakımX |
| `/quotes/[id]` | Teklif Detayı \| BakımX |
| `/quotes/new` | Yeni Teklif \| BakımX |
| `/quotes` | Teklifler \| BakımX |
| `/reminders/[id]/edit` | Bakım Hatırlatmasını Düzenle \| BakımX |
| `/reminders/[id]` | Bakım Hatırlatması Detayı \| BakımX |
| `/reminders/new` | Yeni Bakım Hatırlatması \| BakımX |
| `/reminders` | Bakım Hatırlatmaları \| BakımX |
| `/reports/collections` | Tahsilat Raporu \| BakımX |
| `/reports/customers` | Müşteri Raporu \| BakımX |
| `/reports/orders` | İş Emri Raporu \| BakımX |
| `/reports` | Raporlar \| BakımX |
| `/reports/parts` | Parça Raporu \| BakımX |
| `/reports/technicians` | Teknisyen Raporu \| BakımX |
| `/settings/appointment-rules` | Randevu \| BakımX |
| `/settings/billing` | Faturalandırma \| BakımX |
| `/settings/branding` | Marka \| BakımX |
| `/settings/calendar` | Takvim Ayarları \| BakımX |
| `/settings/communication` | İletişim \| BakımX |
| `/settings/general` | Genel \| BakımX |
| `/settings/notifications` | Bildirim Ayarları \| BakımX |
| `/settings/pdf-templates` | PDF \| BakımX |
| `/settings/plans` | Paketler \| BakımX |
| `/settings/profile` | Profil \| BakımX |
| `/settings` | Ayarlar \| BakımX (hub yönlendirme) |
| `/settings/security` | Güvenlik \| BakımX |
| `/settings/team` | Ekip Yönetimi \| BakımX |
| `/settings/working-hours` | Çalışma saatleri \| BakımX |
| `/smart-capture/registration` | Ruhsat Okuma \| BakımX |
| `/suppliers/[id]/edit` | Tedarikçi Düzenle \| BakımX |
| `/suppliers/[id]` | Tedarikçi Detayı \| BakımX |
| `/suppliers/new` | Yeni Tedarikçi \| BakımX |
| `/suppliers` | Tedarikçiler \| BakımX |
| `/technician/orders/[id]` | Teknisyen İş Emri \| BakımX |
| `/technician` | Teknisyen Paneli \| BakımX |
| `/vehicles/[id]/edit` | Araç Düzenle \| BakımX |
| `/vehicles/[id]` | Araç Detayı \| BakımX |
| `/vehicles/[id]/passport` | Araç Pasaportu \| BakımX |
| `/vehicles/new` | Yeni Araç \| BakımX |
| `/vehicles` | Araçlar \| BakımX |
| `/workshop` | Yönlendirme hedefinin başlığı |
| `/admin-login` | Personel Girişi \| BakımX |
| `/forgot-password` | Şifremi Unuttum \| BakımX |
| `/login` | Giriş Yap \| BakımX |
| `/register` | Ücretsiz Hesap Oluştur \| BakımX |
| `/register/sales/[token]` | Hesap Oluştur \| BakımX |
| `/reset-password/[token]` | Yeni Şifre Belirle \| BakımX |
| `/acik-riza` | Açık Rıza Metni \| BakımX |
| `/admin/admins` | Yöneticiler · Yönetim \| BakımX |
| `/admin/audit` | Denetim Kayıtları · Yönetim \| BakımX |
| `/admin/billing` | Abonelikler · Yönetim \| BakımX |
| `/admin/catalog/[id]` | Ürün Detayı · Yönetim \| BakımX |
| `/admin/catalog/brands` | Katalog Markaları · Yönetim \| BakımX |
| `/admin/catalog/import` | Katalog İçe Aktar · Yönetim \| BakımX |
| `/admin/catalog/new` | Yeni Ürün · Yönetim \| BakımX |
| `/admin/catalog/orders` | Parça Siparişleri · Yönetim \| BakımX |
| `/admin/catalog` | Ürün Kataloğu · Yönetim \| BakımX |
| `/admin/communications` | İletişim Merkezi · Yönetim \| BakımX |
| `/admin/health` | Sistem Sağlığı · Yönetim \| BakımX |
| `/admin/leads` | Demo ve Destek Talepleri · Yönetim \| BakımX |
| `/admin/live-chat` | Canlı Destek · Yönetim \| BakımX |
| `/admin/live-chat/settings` | Canlı Destek Ayarları · Yönetim \| BakımX |
| `/admin` | Genel Bakış · Yönetim \| BakımX |
| `/admin/sales/account` | Danışman Hesabım · Yönetim \| BakımX |
| `/admin/sales/advisors` | Satış Danışmanları · Yönetim \| BakımX |
| `/admin/sales/commissions` | Komisyonlar · Yönetim \| BakımX |
| `/admin/sales/leads/[id]` | Satış Adayı Detayı · Yönetim \| BakımX |
| `/admin/sales/leads` | Satış Adayları · Yönetim \| BakımX |
| `/admin/sales` | Satış Paneli · Yönetim \| BakımX |
| `/admin/sales/performance` | Satış Performansı · Yönetim \| BakımX |
| `/admin/sales/settings` | Satış Ayarları · Yönetim \| BakımX |
| `/admin/status` | Durum Yönetimi · Yönetim \| BakımX |
| `/admin/workshops/[id]` | İş Yeri Detayı · Yönetim \| BakımX |
| `/admin/workshops` | İş Yerleri · Yönetim \| BakımX |
| `/blog/[slug]` | Yazının başlığı \| BakımX |
| `/blog` | BakımX Blog: Servis Yönetimi ve Rehberler |
| `/checkout` | Siparişi Tamamla \| BakımX |
| `/contact-us` | İletişim \| BakımX |
| `/demo` | Canlı Demo Talebi \| BakımX |
| `/destek/[token]` | Destek Görüşmesi \| BakımX |
| `/dijital-arac-kabul` | Dijital Araç Kabul: Ruhsat, Fotoğraf ve Hasar Kaydı \| BakımX |
| `/fiyatlar` | Oto Servis Programı Fiyatları \| BakımX |
| `/invite/[token]` | Ekip Daveti \| BakımX |
| `/invite/sales/[token]` | Satış Danışmanı Daveti \| BakımX |
| `/is-emri-programi` | İş Emri Programı: İş ve Onay Takibi \| BakımX |
| `/karsilastir/defter-excel-oto-servis-programi` | Defter, Excel ve Oto Servis Programı Karşılaştırması \| BakımX |
| `/kvkk` | KVKK Aydınlatma Metni \| BakımX |
| `/oto-servis-programi` | Oto Servis Programı: Araç Kabulden Teslimata \| BakımX |
| `/p/[token]` | Araç Pasaportu \| BakımX |
| `/` | BakımX: Oto Servis Yönetim Platformu |
| `/payment/result` | Ödeme Sonucu \| BakımX |
| `/privacy` | Gizlilik Politikası \| BakımX |
| `/kilavuz` | Kullanım Kılavuzu \| BakımX |
| `/rehber/arac-kabul-formu` | Araç Kabul Formu: 8 Adımlık Kontrol Listesi \| BakımX |
| `/rehber/oto-servis-is-emri-nasil-hazirlanir` | Oto Servis İş Emri Nasıl Hazırlanır? \| BakımX |
| `/s/[token]` | Servis Özeti ve Onay \| BakımX |
| `/satin-al` | Yönlendirme hedefinin başlığı |
| `/status` | Sistem Durumu \| BakımX |
| `/terms` | Kullanım Koşulları \| BakımX |
| `/w/[code]` | İş Yeri Girişi \| BakımX |

## Doğrulama ve teslim

- `src/lib/page-titles.test.ts`: bütün sayfalarda metadata kapsamı, boş/çift markalı literal başlıklar ve nested layout şablonları.
- `e2e/page-titles.e2e.ts`: public/giriş sayfaları, mevcut blog yazıları, client navigation ve geri tuşu, uygulama/yönetim nested rotaları ve yönlendirme.
- İlgili SEO/landing testleri: 187 başarılı. Build ve lint başarılı; build TypeScript kontrolünü de içerir.
- Genel birim test koşusu: 2353 başarılı, 2 atlanan, 1 mevcut hata. `src/lib/llms.test.ts` 6 bağlantı bekliyor; görev öncesi yerel blog eklemesi `LLMS_PUBLIC_PATHS` listesini 7'ye çıkarmış. Bu görev listeyi değiştirmez.
- Commit kapsamının bağımsız kontrolü (`git checkout-index` ile temiz geçici dizin): 2347 test başarılı, 2 atlanan, 0 hata; TypeScript ve lint başarılı. Blog/iletişim layout ayrımı sonrası 3 tarayıcı kontrolü de başarılı.
- Dal: `issue/642-page-titles`. Mevcut yerel tasarım/blog değişiklikleri korunur; başlık geliştirmesi ayrı commit olarak kaydedilir; PR açılmaz. Production yayını yapılmadı.
- Blog ve iletişim başlıkları ayrı `src/app/blog/layout.tsx` ve `src/app/contact-us/layout.tsx` dosyalarında tutulur. Sayfa içerikleri ve tasarımları ayrı yerel çalışmadır; bu commit bunları içermez. E2E testleri bu içerikler bulunmayan checkout’ta yalnız ilgili kontrolleri atlar.
- Sonraki sahip: yerel tasarım/blog teslimatını birleştirecek geliştirici; `llms.txt` beklentisi bu kapsamda uzlaştırılmalı.
