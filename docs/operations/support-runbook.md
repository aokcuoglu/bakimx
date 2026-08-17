# Destek runbook — şikayet geldiğinde ne yapılır

**Durum:** öneri — BAK-88 kapsamında hazırlandı, onay bekliyor.
Erişim/rol modeli ve konsolun eksikleri: [platform-admin-model.md](./platform-admin-model.md).

---

## 0. Üç kural

1. **Prod'da müşteri verisiyle deneme yapılmaz.** Şikayeti yeniden üretmek için
   `app-dev.bakimx.com` üzerindeki **destek test kiracısı** kullanılır. Prod'da
   yalnız salt-okunur impersonation ile *bakılır*.
2. **Her impersonation'ın bir gerekçesi olur.** `startImpersonation` gerekçe alanı
   kabul eder ve denetim kaydına yazar — boş bırakmayın, talep numarasını yazın.
   Oturum 30 dakikada kendiliğinden düşer ve zaten hiçbir kiracı verisini yazamaz.
3. **Kapanışta ne yaptığınızı yazın.** Talep kaydına: teşhis, yapılan işlem,
   müşteriye söylenen cümle.

---

## 1. Teşhis sırası (her şikayet için aynı)

`/admin` → **İş Yerleri** → ilgili atölye → detay sayfası. Bu tek sayfa şunları
bir arada gösterir:

| Bölüm | Neyi cevaplar |
|---|---|
| Başlık rozetleri | `approvalStatus` (pending/approved/rejected), `subscriptionStatus` (trialing/active/past_due/canceled), paket |
| Deneme / abonelik satırı | Kaç gün kaldı — "birden çalışmamaya başladı" şikayetlerinin en sık cevabı |
| **Ekip & Koltuk** | Kullanıcılar, rolleri, **pasif** olanlar, koltuk limiti |
| **Son İşlemler (Denetim)** | Kim ne yaptı |
| **İletişim & İşler** | Gönderilen e-postalar ve `sent` / `failed` durumları |
| **Özellik Bayrakları** | Müşterinin gördüğü özellik gerçekten açık mı |

> Bugün bu sayfaya iş yeri **adıyla arama** yok; liste tarih sırasında geliyor
> (`platform-admin-model.md` §4/1). Tarayıcı içi arama kullanın.

---

## 2. Senaryo A — "Giriş yapamıyorum"

Sırayla eleyin:

1. **Hesap hangi tipte?**
   - E-posta ile giriş → `/login`.
   - Kullanıcı adı ile giriş (usta/çırak, e-postasız hesap) → atölyeye özel
     `/w/<iş-yeri-kodu>` ekranı. Kullanıcı adları **yalnız kendi atölyesinde**
     benzersizdir; iş yeri kodu olmadan giriş yapılamaz. Müşteri yanlış ekranda
     deniyor olabilir — en sık sebeplerden biri budur.
2. **Kullanıcı pasif mi?** Detay sayfasında "pasif" rozeti. Pasif koltuk giriş
   yapamaz; atölye sahibi `Ayarlar → Ekip`ten yeniden aktifleştirir.
3. **Atölyenin durumu ne?**
   - `rejected` → giriş engellenir, kullanıcı "Başvurunuz onaylanmadı" görür.
   - `pending` → giriş **açılır**, kullanıcı e-posta doğrulama ekranına düşer
     (doğrulama e-postasını oradan tekrar isteyebilir).
   - Deneme/abonelik bitmiş → giriş açılır ama `/checkout`'a yönlenir. Müşterinin
     "içeri giremiyorum" dediği şey çoğu zaman budur; sorun kimlik değil ödemedir.
4. **Şifre gerçekten yanlış mı?** Ard arda hatalı denemede hesap başına dakikada
   8 deneme sınırı devreye girer ve kullanıcı "Çok fazla deneme yapıldı" görür —
   bu bir kilit değil, **bir dakika** sonra düşer. Müşteriye bunu söyleyin.

**Yapmayın:** müşterinin şifresini bilmeye çalışmak, prod'da onun hesabıyla giriş
denemek. Gerekiyorsa salt-okunur impersonation kullanın.

---

## 3. Senaryo B — "Şifre sıfırlama e-postası gelmiyor"

1. **Kullanıcının e-postası var mı?** E-postasız (kullanıcı adı ile giren) hesaplar
   bu akışa **hiç girmez** — tasarım böyle. Çözüm: atölye sahibi
   `Ayarlar → Ekip → şifre sıfırla` ile geçici şifre üretir; kullanıcı ilk girişte
   kendi şifresini belirlemeye zorlanır.
2. **Detay sayfası → İletişim & İşler.** `password_reset` kaydı var mı, `status`
   ne? `failed` ise sorun bizde (sağlayıcı), `sent` ise müşteride (spam/yanlış adres).
3. **Adres doğru mu?** Ekip listesinde görünen e-posta ile müşterinin söylediği
   aynı mı. Farklıysa: bugün konsoldan e-posta düzeltme aksiyonu **yok** — atölye
   sahibi kendi hesabından değiştirir.
4. **Hiç kayıt yoksa** istek uca hiç ulaşmamıştır: form hatası veya IP/e-posta
   limiti (15 dakikada e-posta başına 3, IP başına 5). Limit sessizce yutulur ve
   kullanıcıya yine "gönderildi" der — hesap var mı sorusunu sızdırmamak için.
   Müşteriye 15 dakika beklemesini söyleyin.

**Sahip kilitli kaldıysa** (e-posta adresi ölü, atölyede başka yönetici yok): bu
bugün konsoldan çözülemez, elle müdahale gerekir. Kim yaptıysa yazılı gerekçe
bıraksın.

---

## 4. Senaryo C — "Ekran/portal çalışmıyor"

1. **Deploy sonrası mı?** Deploy sonrası beyaz ekran çoğunlukla bayat sekmedeki
   `ChunkLoadError`'dır — sert yenileme (Cmd/Ctrl+Shift+R) çözer.
2. **Özellik bayrağı kapalı mı?** Detay sayfası → Özellik Bayrakları. Müşteri
   paketinin kapsamadığı bir özelliği soruyor olabilir.
3. **Genel mi, tek müşteriye mi özel?** `/admin/health` ortam kontrollerini
   gösterir. Birden fazla müşteri aynı anda yazıyorsa altyapıdır; tek müşteriyse
   veri/ayar sorunudur.
4. **Yeniden üretin:** destek test kiracısında aynı adımları izleyin. Üretilemiyorsa
   prod'da salt-okunur impersonation ile aynı ekrana bakın.

---

## 5. Tırmandırma

| Durum | Ne yapılır |
|---|---|
| Birden fazla müşteriyi etkiliyor | Kurucuya haber, `/admin/health` + ECS logları, müşteriye durum bildirimi |
| Veri kaybı ya da yanlış kiracıya veri görünmesi | **Hemen** kurucuya. Ekran görüntüsü + zaman damgası + iş yeri kimliği |
| Güvenlik açığı bildirimi | `SECURITY.md` akışı — herkese açık issue **açılmaz** |
| Ödeme / iade | `/admin/billing`; iade kararını kurucu verir |

---

## 6. Müşteriye söylenecek cümleler

- Şifre limiti: *"Güvenlik için art arda hatalı denemede giriş bir dakika
  bekletiliyor. Bir dakika sonra tekrar deneyin."*
- Deneme bitmiş: *"Deneme süreniz doldu; hesabınız duruyor, verileriniz yerinde.
  Paket seçtiğinizde kaldığınız yerden devam edersiniz."*
- Kullanıcı adıyla giriş: *"Usta hesapları iş yerinize özel giriş adresinden
  giriyor: bakimx.com/w/<kodunuz>."*
- İnceleme: *"Hesabınıza teknik ekibimiz yalnızca sorunu görmek için, kayıt altına
  alınan ve hiçbir değişiklik yapamayan bir modda bakıyor."*
