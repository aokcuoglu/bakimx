# BakımX — WhatsApp Business satış ve destek kurulumu

İş: [#627](https://github.com/aokcuoglu/bakimx/issues/627). Kullanıcının kabul ettiği
kapsam: mevcut Business hesabı, 2–4 kişilik ekip, hafta içi 09.00–18.00 (Europe/Istanbul).

**Durum:** Bu belge uygulanacak ayarları içerir. Telefon hesabına erişilip profil,
otomatik yanıtlar veya bağlı cihazlar değiştirilmiş değildir. Aşağıdaki telefon
kabul maddeleri hesap sahibi tarafından tamamlanana kadar kurulum tamamlandı sayılmaz.

## 1. Hesap sahibinin telefonunda

Mevcut WhatsApp Business hesabında numaranın **+90 542 368 14 38** olduğunu
doğrulayın. Hesabı silmeyin, yeniden kaydetmeyin veya başka uygulamaya taşımayın.
İşletme araçları → İşletme profili bölümünü açın (menü konumu iOS/Android'e göre değişebilir).

| Alan | Değer |
|---|---|
| İşletme adı | BakımX |
| Kategori | Sunulan listede yazılım/bilişim hizmetlerine en yakın kategori |
| Profil fotoğrafı | [Mevcut açık zeminli logo](../../public/03-bakimx-icon-light.png) |
| Açıklama | Oto servisler için dijital araç kabul, iş emri ve işletme yönetimi yazılımı. Demo, satış ve kullanıcı desteği. |
| Web sitesi | https://bakimx.com |
| Çalışma saatleri | Pazartesi–Cuma 09.00–18.00; Cumartesi/Pazar kapalı |
| İletişim bağlantısı | https://wa.me/905423681438 |

Doğrulanmamış adres/e-posta eklemeyin. Telefon saat dilimini İstanbul olarak kontrol
edin. Hesap → İki adımlı doğrulama ve yedekleme durumunu kontrol edin; kurtarma
e-postası şirket sorumlusunun erişebildiği doğrulanmış adres olmalıdır. PIN ve
doğrulama kodları rehbere, issue'ya veya sohbete yazılmaz.

## 2. İşletme araçları → mesajlaşma araçları

### Karşılama mesajı

Etkinleştirin; alıcı kapsamını herkese olarak ayarlayın. Uygulama mesajı kendi
karşılama tetikleme kurallarına göre gönderir; her gelen mesaja tekrar göndermez.

```text
Merhaba, BakımX’e hoş geldiniz. Demo ve paketler hakkında bilgi almak veya kullanıcı desteği için bize yazabilirsiniz. İşletmenizin adını ve talebinizi kısaca paylaşmanız yeterli.
```

### Mesai dışı mesajı

Etkinleştirin; zamanlamayı işletme saatleri dışında, alıcı kapsamını herkese ayarlayın.
Ana telefonun internet erişimi olduğunda test edin. Sürekli açık zamanlamasını seçmeyin.

```text
Merhaba, BakımX’e ulaştınız. Çalışma saatlerimiz hafta içi 09.00–18.00’dir. Mesajınızı bir sonraki çalışma saatimizde değerlendireceğiz. İşletmenizin adını ve talebinizi paylaşabilirsiniz.
```

### Hızlı yanıtlar

Bu yanıtlar operatörün seçip gönderdiği kısayollardır; chatbot değildir.

| Kısayol | Mesaj |
|---|---|
| `/demo` | BakımX’i incelemek ve demo talebi oluşturmak için: https://bakimx.com/demo |
| `/paket` | Güncel paket ve fiyatlarımız: https://bakimx.com/fiyatlar |
| `/destek` | İşletmenizin adını, sorun yaşadığınız ekranı ve gördüğünüz hata mesajını paylaşabilir misiniz? |
| `/kapanis` | Talebinizi tamamladık. Aynı konuda tekrar yardıma ihtiyacınız olursa bu görüşmeden yazabilirsiniz. |

## 3. Ekip düzeni

- Ana telefon, SIM ve kurtarma erişimi şirket sorumlusunda kalır.
- Ayarlar → Bağlı cihazlar üzerinden her ekip üyesinin cihazını ana telefonla
  eşleyin. Standart hesap ana telefon yanında en fazla dört bağlı cihaz destekler;
  kişi başına bir cihaz ayırın. Yeni hesap kaydı açmayın.
- Kabul edilen erişim modeli: 2–4 kişilik ekip aynı şirket gelen kutusunu görür.
  Kişi bazında görüşme gizleme veya uygulama RBAC entegrasyonu bu kurulumda yoktur.
- Etiketler: **Yeni talep**, **Demo/Satış**, **Destek**,
  **Müşteriden yanıt bekleniyor**, **Tamamlandı**. Operatör bunları elle günceller.
- İlk yanıtı veren kişi adını yazar ve talebi sahiplenir. Devirde mevcut sorumlu,
  yeni sorumluya talebin özetini ekip içinde iletir; yeni sorumlu devri teyit eder.
- Gün sonunda açık talepler kontrol edilir. Hata incelemesi ve tırmandırmada
  [destek runbook'u](support-runbook.md) kullanılır; müşteri şifresi istenmez.
- Kullanıcının bir destek görüşmesi başlatması kampanya izni değildir. Sonraki
  tanıtım mesajları için izin alınır ve iletişimden çıkma talepleri uygulanır.

## 4. Web bağlantısı ve yayın

Mevcut paket/fiyat ekranlarındaki **WhatsApp ile iletişim** bağlantısı
`NEXT_PUBLIC_SUPPORT_WHATSAPP=905423681438` kullanır. Boş veya eksik ayarda da
aynı şirket numarasına gider. Hazır mesaj URL içine kodlanır; gönderim kullanıcının
WhatsApp'ta Gönder'e basmasıyla gerçekleşir.

Docker aynı adlı build arg'ı kabul eder. DEV/PROD workflow'ları isteğe bağlı
`DEV_NEXT_PUBLIC_SUPPORT_WHATSAPP` / `PROD_NEXT_PUBLIC_SUPPORT_WHATSAPP` repository
variables değerlerini geçirir; belirtilmemişse şirket numarası kullanılır.
Yeni GitHub değişkeni veya API anahtarı eklemek zorunlu değildir.
`NEXT_PUBLIC_*` derlemede sabitlendiği için ECS runtime değişikliği tek başına yetmez.

Bu değişiklik oto servislerin müşteri numaralarını veya paylaşım seçicilerini
değiştirmez. `WHATSAPP_PROVIDER=mock` korunur. Meta Portfolio, Cloud API, chatbot,
katalog, ücretli servis ve toplu kampanya kurulumu kapsam dışındadır.

Önce DEV PR ve kalite kapıları tamamlanır. Production konfigürasyonu veya yayını
için [AGENTS.md](../../AGENTS.md) insan onayı gerekir; `dev` birleşmesi production
kurulumu tamamlandı anlamına gelmez. Geri alma: web değişikliğini ayrı PR ile geri
alın; production geri dönüşü de yayın onayına tabidir. Telefon hesabı taşınmadığı
için web değişikliğini geri almak konuşma geçmişine dokunmaz.

## 5. Kabul kontrolü — doğrulanmadan işaretlemeyin

### Web uygulaması (uygulayan mühendis)

Yerel doğrulama: 2026-09-08. AWS image yayını ve gerçek WhatsApp hesabı bu kanıta dahil değildir.

- [x] `bun test` (2177 geçti, isteğe bağlı PostgreSQL testi atlandı), lint, typecheck ve build geçti.
- [x] Production build'in `/fiyatlar` bağlantısı `https://wa.me/905423681438` alıcısını taşıyor.
- [x] Masaüstü (1440 px) ve mobil (390 px) bağlantısı erişilebilir; masaüstünde klavyeyle açıldı.
- [x] Türkçe hazır mesaj korundu; dış istek testte karşılandı, yalnız GET bağlantısı açıldı.
- [x] Atölye/müşteri paylaşım bağlantıları kendi alıcılarını koruyor (birim testi).

Tekrar çalıştırma: şirket numarasıyla `bun run build`, ayrı portta `bun run start -- -p 3627`,
ardından `PLAYWRIGHT_PORT=3627 bunx playwright test e2e/support-whatsapp.e2e.ts`.
İki tarayıcı testi geçti. Sunucu başlatılırken farklı runtime numarası verilmesine
rağmen bağlantı build'deki şirket numarasını korudu; derleme zamanı davranışı da doğrulandı.

### WhatsApp hesabı (hesap sahibi + ekip)

- [ ] Numara, profil, logo ve çalışma saatleri başka bir telefondan doğrulandı.
- [ ] Şirketin kontrolündeki test hesabından yeni görüşmede karşılama mesajı alındı.
- [ ] Mesai dışında test hesabına mesai dışı mesajı geldi; mesai içinde yanlış tetiklenmedi.
- [ ] Dört hızlı yanıt uygulamada açılıp test hesabına doğru metinle gönderildi.
- [ ] Yetkili ekip cihazları bağlı; test görüşmesi ve ekip içi devir doğrulandı.
- [ ] Etiketler ve gün sonu açık talep kontrolü çalışıyor.

### Production (onay sonrası)

- [ ] Yayınlanacak kesin commit kapsamı ve production onayı kaydedildi.
- [ ] Production deploy başarılı; canlı sitede doğru WhatsApp alıcısı doğrulandı.

Test mesajları yalnız şirketin kontrolündeki test hesabıyla gönderilir. Telefon
ayarları ve canlı WhatsApp teslimatı, web bağlantısının testinden ayrı kanıtlanır.

## Resmî kaynaklar

- [WhatsApp Business özellikleri](https://business.whatsapp.com/products/business-app-features)
- [Business hesabında bağlı cihazlar](https://faq.whatsapp.com/647349420360876)
- [WhatsApp Business mesajlaşma politikası](https://business.whatsapp.com/policy)
- Next.js: kurulu `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`

## Araç teslim OTP entegrasyonu (#631)

Teslimata hazır araçta **WhatsApp Teslim Kodu Gönder** aksiyonu kullanılır.
İş emri açılışında OTP gönderilmez. SMS fallback yoktur. Kod 10 dakika geçerlidir;
yeniden kod istendiğinde eski bekleyen kod geçersizleşir. Kodun kendisi veritabanına
ve sayfa props'una yazılmaz; SHA-256 özeti saklanır. Önceden SMS ile oluşturulmuş
bekleyen kodlar için yeni WhatsApp kodu istenmelidir.

`WHATSAPP_PROVIDER=mock` ağ isteği yapmaz; ekranda gerçek mesaj gönderilmediği
belirtilir ve demo kodu gösterilir. `NODE_ENV=development` tek başına gerçek OTP'yi
görünür yapmaz. Gerçek mod müşterinin `whatsappConsent` iznini gerektirir.

Gerçek aktivasyon için (şu an tamamlandığı varsayılmamalı):

1. Meta Business Portfolio ve WhatsApp Business Account erişimini doğrula.
   Mevcut Business uygulaması hesabını silme veya numarayı habersiz taşıma.
   Aynı numarayla uygulamayı korumak için Meta'nın hesapta sunduğu coexistence
   onboarding uygunluğunu kontrol et; uygun değilse numara kararını hesap sahibi verir.
2. WhatsApp Manager'da +905423681438 numarasının **Phone Number ID** değerini
   doğrula. Bu ID telefon numarası değildir; gönderici bu ID ile belirlenir.
3. `bakimx_teslim_otp` adlı Türkçe (`tr`) AUTHENTICATION, COPY_CODE düğmeli
   şablonu oluştur; kod süresini 10 dakika olarak ayarla. Şablonun APPROVED
   olduğunu doğrula. Hesabın authentication template uygunluğu Meta'ya bağlıdır.
4. Yalnız localhost/AWS Dev gizli yapılandırmasına `WHATSAPP_PHONE_NUMBER_ID`,
   `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_OTP_TEMPLATE_NAME=bakimx_teslim_otp`,
   `WHATSAPP_OTP_TEMPLATE_LANGUAGE=tr` ve `WHATSAPP_API_URL=https://graph.facebook.com/v25.0`
   ekle. Token'ı issue, log veya sohbet içine yazma. AWS'deki eski `WHATSAPP_TOKEN`
   adı uygulamanın beklediği `WHATSAPP_ACCESS_TOKEN` yerine geçmez; ECS secret
   eşlemesi doğru adla yapılmalıdır.
5. Sonra `WHATSAPP_PROVIDER=business` ile yeni Dev task başlat. Onay verilmiş test
   alıcısında gönderici numarasını ve mesajın telefona ulaştığını kontrol et;
   yanlış/süresi geçmiş kodla teslimin reddini ve doğru kodla teslimi doğrula.
   API'nin message ID döndürmesi teslimat kanıtı değildir; teslim webhook'u bu
   kapsamda yoktur. Gerçek telefonda doğrulanmadan aktivasyonu tamamlandı sayma.

Production/main yayını kullanıcının talimatıyla yasaktır.

Meta şablon protokolü:
https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/copy-code-button-authentication-templates
