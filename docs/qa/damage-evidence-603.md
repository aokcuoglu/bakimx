# Fotoğraf ve hasar kaydı (#603)

## Veri sözleşmesi

Kabul başına artan, silinince yeniden kullanılmayan hasar numarası; aynı bölgeye birden fazla kayıt. `DamagePhoto` çoktan çoğa bağı saklar. Yeni fotoğraf kaynak dosyası yönü düzeltilerek 1600 px uzun kenar/JPEG 0.85 sınırında hazırlanır. `PhotoAnnotationVersion` normalize koordinatlar ve ayrı türev anahtarı saklar; kaynak ve eski türevler değiştirilmez. Editör lazy Konva/react-konva kullanır; SVG araç geometrileri özgün koddan gelir.

Hasarsızlık başlangıç varsayımı değildir. Açık personel kontrolünde kim/zaman kaydedilir; hasar ekleme kontrol sonucunu temizler, son hasarın silinmesi hasarsızlık oluşturmaz. Şema türü ve sürümü kabul kaydındadır. Sağ/sol sürüş yönüne göredir; model geometrisi/fitment iddiası yoktur.

GET/POST/PATCH `/api/intakes/damage`, POST/GET `/api/intakes/photos/annotations`. Yeni mutasyonlar tenant, RBAC, kapalı iş emri ve #601 ortak özellik kapılarıyla korunur. Annotation kaydı `expectedVersion` ile eski sürüm üzerine yazmayı reddeder. Tekrar deneme aynı requestId ile aynı kaydı döndürür. İşlem kilit sırası order → intake → photo; audit aynı transaction içindedir.

`/api/photos?id=...&variant=original` personel kaynağı; varsayılan en son türevdir. Müşteri görselleri `/s/[token]/photos/[photoId]` üzerinden yetkili sunulur. `showDamage=false` işaretsiz kaynağı, `showPhotos=false` hiçbir fotoğrafı sunar. Eski JPEG'e gömülmüş işaretler geriye dönük ayrılamaz. Çizim JSON'u hiçbir müşteri DTO'suna girmez.

## Migration

`20260905120000_damage_capture` eklemelidir. Eski kayıtlar kabul/createdAt/id sırasıyla numaralanır; fotoğraf ilişkisi tahmin edilmez. Eski fotoğraf anahtarları korunur. Hafif ticari için van, desteklenmeyen tipler için bölge listesi önerilir. Üretim migration çalıştırılmadı. Geri almada eski uygulama sürümü ek kolonları kullanmadan çalışabilir; yeni verileri korumak için kolon/tablo düşürülmemelidir.

Yerel PostgreSQL 17 üzerinde tüm migration geçmişi uygulandı. Ayrı eski-şema fixture'ında 3 hasar 1/2 ve 1 numaralarını aldı, sayaçlar 2/1 oldu, fotoğraf anahtarı aynı kaldı ve ilişki tablosu boş kaldı.

Temiz kurulumda bu işten önceki migration geçmişi ile Prisma şeması arasında fark bulundu: PlanTier.lite, Workshop.extraVinQuota, quota_usage ve bazı indeksler. Yalnız geçici QA veritabanı Prisma diff SQL'iyle tamamlandı; mevcut migration dosyaları değiştirilmedi, paylaşılan/üretim veritabanına işlem yapılmadı. Bu fark #603 migration'ından bağımsızdır.

## Doğrulama

- Birim: geometri kimlikleri/yönler, normalize koordinat/dönüşüm/history, şema sınırları, safe DTO görünürlük/soft-delete, A4 numara-fotoğraf eşleşmesi/HTML kaçışları.
- `damage-records-api.e2e.ts`: gerçek API ve ayrı fixture; eşzamanlı idempotence/numara, açık kontrol geçişleri, atölyeler arası bağlama reddi, sürüm çakışması/yeniden açma, kaynak değişmezliği, dört görünürlük birleşimi/süresi dolmuş token, kapalı iş emri, soft-delete, Lite temel fotoğraf ve deneme yetkileri.
- `damage-records.e2e.ts`: gerçek iş emri kabuğu ve izole API yanıtları; 3×5 görünüş, kart/düzenleme/silme, mobil/masaüstü ve iki temada axe AA, klavye ve browser-back taslak koruması.
- `photo-annotations.e2e.ts`: gerçek kaynak/türev yükleme, hata/tekrar deneme, dokunma çizimi, sürümlerin yeniden açılması.
- A4: Chromium PDF çıktısı iki sayfa halinde Poppler ile PNG'ye çevrilip incelendi; beş görünüş, #7/#9 eşleşmesi, fotoğraflı ve fotoğrafsız kart, taşma/kırpılma yok. QA görselleri temsili test verisidir.

Fiziksel cihaz kullanmadan Chromium ve WebKit tarayıcı motorlarıyla mobil doğrulama yapılır. Üretim yayını bu issue'nun kapsamı dışındadır.
