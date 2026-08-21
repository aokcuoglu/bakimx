# BakımX platform yönetim modeli

**Durum:** öneri — BAK-88 kapsamında hazırlandı, onay bekliyor.
**Kapsam:** BakımX **şirketinin kendi** personelinin `www.bakimx.com` / `app.bakimx.com`
üzerindeki erişimi. Atölyelerin kendi ekip yönetimi (`UserRole`, `/settings?tab=team`)
bu dokümanın konusu değildir.

Destek talebi geldiğinde izlenecek adımlar ayrı dokümanda:
[support-runbook.md](./support-runbook.md).

---

## 1. Bugün ne var

Bunlar kodda doğrulanmış gerçeklerdir, tasarım hedefi değil.

| Konu | Bugünkü durum | Kaynak |
|---|---|---|
| Konsol | `/admin`, 9 bölüm (Genel Bakış, İş Yerleri, Faturalandırma, Talepler, Canlı Destek, Ürün Kataloğu, Özellik Bayrakları, Denetim Kaydı, Sistem Sağlığı) | `src/app/admin/admin-nav.tsx:30` |
| Üyelik | `PlatformAdmin` tablosu (BAK-93). `ADMIN_EMAILS` yalnız tablo boşken çalışan bootstrap yolu; ikisi de boşsa konsol **herkese 404**. Karar şifreli giriş ve SSO için ORTAK (BAK-114) | `src/lib/admin-membership.ts` |
| Kimlik | Admin, bir atölyeye ait normal bir `User` satırıdır; `PlatformAdmin` o kullanıcıya platform erişimi ekler | `prisma/schema.prisma` |
| Rol | `founder \| support \| finance \| readonly`; `can()` §2'deki matristen karar verir | `src/lib/admin.ts` |
| Oturum iptali | `PlatformAdmin.sessionsValidFrom` + oturumdaki `authenticatedAt` — erişimi kapatılan yönetici açık sekmesinde de 404 alır | `src/lib/admin.ts`, `src/lib/session.ts` |
| Yetki kancası | `AdminCapability` + `requireAdminCapability()` çağrı yerlerinde zaten kullanılıyor | `src/lib/admin.ts:87` |
| Impersonation | **Salt-okunur**, 30 dk sabit süre, DB kaydı + denetim kaydı, Prisma yazma kilidi | `src/app/admin/impersonation-actions.ts:13` |
| Denetim | Sayfalı, iş yeri + işlem filtreli | `src/app/admin/audit/page.tsx` |
| Giriş güvenliği | bcrypt(12), sabit-zamanlı karşılaştırma, IP (40/dk) + hesap (8/dk) limiti, jenerik hata mesajı | `src/lib/auth-login.ts` |
| Şifre sıfırlama | Token hash'lenerek saklanır, jenerik yanıt, IP+e-posta limiti | `src/app/api/auth/forgot-password/route.ts` |

**Değerlendirme:** bu, bu olgunluktaki bir SaaS için beklenenin üzerinde. Özellikle
salt-okunur + süreli + denetlenen impersonation, çoğu erken aşama ekibin yıllarca
atladığı bir kontrol. Aşağıdaki eksikler bu temelin üzerine eklenecek katmanlardır.

---

## 2. Karar 1 — Tek kullanıcı mı, ekip mi?

**Öneri: ekip, ama tek kademeli değil.** Paylaşılan tek hesap üç şeyi birden bozar:
denetim kaydı "kim yaptı" sorusuna cevap veremez, işten ayrılan kişinin erişimi
kesilemez, ve her personel tüm müşteri verisine bakabilir.

Kurumsal SaaS pratiğinde standart olan üç kural — kaynaklar §7'de:

1. **Kişi başı hesap.** Rol paylaşılır, kimlik paylaşılmaz.
2. **En az yetki.** Destek personeli okuyabilmeli, silememeli.
3. **Yaşam döngüsü.** İşe alım / rol değişimi / ayrılış için tanımlı adımlar,
   çeyreklik erişim gözden geçirmesi.

### Aşama 0 — bu hafta, kod değişikliği gerekmez

- `ADMIN_EMAILS` içine **yalnız kişisel** adresler; `demo@bakimx.com` gibi ortak
  hesaplar asla (`docs/releasing.md:125` bunu zaten söylüyor).
- Personel hesapları için **ayrı bir iç "BakımX" atölyesi** açın. Bugün her admin
  bir tenant'ın içinde yaşıyor; bunun bir müşteri tenant'ı olması, personel
  hareketlerini müşteri verisiyle aynı yere yazar.
- Kim yönetici, kim değil — tek bir yerde yazılı olsun (bu doküman §6).

### Aşama 1 — asıl öneri (bir sprint)

| # | İş | Durum | Neden |
|---|---|---|---|
| 1 | **`/admin` için ikinci faktör — Google Workspace SSO** | açık | Konsol tüm kiracıların verisine erişiyor ve tek kapısı e-posta+şifre. Sızan tek bir şifre = tüm müşteri verisi. **En yüksek öncelikli açık.** Yöntem kararı §7'de. |
| 2 | **Üyeliği env'den DB'ye taşı** (`PlatformAdmin` tablosu) | **BAK-93 ile geldi** | Personel eklemek/çıkarmak ECS task-def / SSM env değişikliği + yeniden deploy demekti. Artık `/admin/admins` üzerinden; `ADMIN_EMAILS` yalnız tablo boşken çalışan bootstrap yolu. |
| 3 | **Gerçek admin rolleri** | **BAK-93 ile geldi** | `AdminRole` artık `founder \| support \| finance \| readonly`; kısıtlama tek yerden, `src/lib/admin.ts` içindeki `CAPABILITIES` tablosundan. Çağrı yerleri değişmedi. |
| 4 | **Oturum iptali** | **BAK-93 ile geldi** | iron-session durumsuz ve 7 gün ömürlü; env'den bir adresi silmek açık sekmeyi kapatmıyordu. `PlatformAdmin.sessionsValidFrom` + oturumdaki `authenticatedAt` damgası ile erişimi kapatılan yönetici bir sonraki istekte 404 alır. |

Yetki tablosu (uygulanan hâli — kaynak: `src/lib/admin.ts`):

| Yetki | founder | support | finance | readonly |
|---|:--:|:--:|:--:|:--:|
| `viewConsole` | ✅ | ✅ | ✅ | ✅ |
| `manageWorkshops` (onay/red/plan) | ✅ | — | — | — |
| `confirmBilling` | ✅ | — | ✅ | — |
| `impersonate` (salt-okunur) | ✅ | ✅ | — | — |
| `sendPasswordReset` (kullanıcıya bağlantı gönder) | ✅ | ✅ | — | — |
| `manageFlags` | ✅ | — | — | — |
| `manageCatalog` | ✅ | — | — | — |
| `manageLiveChat` | ✅ | ✅ | — | — |
| `viewAudit` | ✅ | ✅ | ✅ | ✅ |
| `viewHealth` | ✅ | ✅ | — | ✅ |
| `exportData` | ✅ | — | ✅ | — |
| `manageLeads` (demo/destek talebi durumu) | ✅ | ✅ | — | — |
| `manageAdmins` (bu liste) | ✅ | — | — | — |

`sendPasswordReset` BAK-97 ile geldi: bağlantı **yalnız** kullanıcının kayıtlı
e-postasına gider ve konsolda hiçbir yerde gösterilmez — aksi hâlde ele geçirilmiş
bir yönetici hesabı tek tıkla herhangi bir kiracı hesabına girebilirdi. Aynı
kullanıcıya tekrar gönderim 5 dakika kilitlidir ve sayaç DB'deki son token'ın
yaşıdır (`src/lib/password-reset.ts`), süreç-içi bir sayaç değil.

Son iki satır bu dokümanın ilk hâlinde yoktu; uygulama sırasında iki kapısız
mutasyon ortaya çıktı (talep durumu güncelleme ve yönetici yönetiminin kendisi)
ve tabloya eklendi. Kapsam `src/lib/admin-gate-coverage.test.ts` ile korunuyor:
`/admin` altında yazma yapıp `requireAdminCapability()` çağırmayan bir action
`bun test`i düşürür.

**Nasıl yönetilir:** `/admin/admins` (yalnız `founder`). Ekleme, rol değiştirme,
erişimi kapatma ve "oturumları kapat" işlemlerinin hepsi `AuditLog`'a düşer ve
denetim sayfasında okunabilir etiketle görünür. Yönetici satırı **silinmez**,
`disabledAt` ile kapatılır — geçmişte kimin yönetici olduğu kaybolmasın diye.

**Bootstrap:** tablo boşken `ADMIN_EMAILS` devreye girer ve ilk yönetici
okumasında adresleri `founder` olarak tabloya yazar. Tablo dolduğu andan sonra
env'in hükmü yoktur: adı env'de geçen ama tabloda satırı olmayan kişi yönetici
değildir. Prod kiracı sıfırlaması (`scripts/prod-reset.ts`) tabloyu boşalttığı
için bu yol oradan dönüşte de çalışır.

Bootstrap **her iki giriş yolunda** da çalışır — kararı `resolveAdminMembership()`
(`src/lib/admin-membership.ts`) tek başına verir ve hem şifreli yol (`resolveAdmin`)
hem Google SSO callback'i (`resolveSsoAdmin`) onu çağırır. BAK-114'e kadar öyle
değildi: SSO doğrudan `platformAdmin.findUnique` okuyordu, yani boş tabloda
`/admin-login` kendi kendine açılamayan bir kapıydı — konsolu açmak için önce
şifreli yoldan geçmek gerekiyordu. Bu, `scripts/prod-reset.ts` sonrası ya da
SSO-öncelikli kurulan yeni bir ortamda geri dönüşü elle DB müdahalesi olan bir
kilitlenmeydi. Ayrışmanın tekrarını `src/lib/admin-membership.test.ts` içindeki
kaynak tarayan test engeller.

**`ADMIN_EMAILS` yine de ölü bir değişken değil.** Konsol üyeliği artık tabloda
ama bu liste hâlâ **sistem bildirimlerinin alıcı listesidir**: yeni iş yeri
kaydı (`api/auth/register`), canlı destek mesajı, TAMI ödeme/konfigürasyon
alarmları (`lib/tami/*-alert.ts`), cron hata bildirimi (`lib/ops/cron-run.ts`),
deneme/abonelik bitiş uyarıları (`lib/billing/lifecycle.ts`) ve
`/admin/health`'in "yönetici e-postası tanımlı mı" kontrolü hep `getAdminEmails()`
okur. Yani buradan bir adres çıkarmak o kişiye giden **bütün** sistem
e-postalarını keser.

**Nerede tutuluyor (2026-08-17'den beri).** Değerin kaynağı her iki ortamda da
SSM Parameter Store: `/bakimx/dev/ADMIN_EMAILS` ve `/bakimx/prod/ADMIN_EMAILS`.
ECS task-def'i onu `secrets[]` girdisi olarak okur (`AI_PROVIDER`,
`EMAIL_PROVIDER` vb. ile aynı desen); daha önce task-def'te düz bir
`environment` girdisiydi ve SSM parametresi **hiç okunmuyordu** — aynı adın iki
yerde farklı değer tutabildiği bu durum, "SSM'i güncelledim" denip hiçbir şeyin
değişmemesine yol açıyordu.

Değiştirme yolu (deploy gerektirmez, ~2 dk, kesintisiz):

```sh
aws ssm put-parameter --name /bakimx/prod/ADMIN_EMAILS --type String --overwrite \
  --value "a@bakimx.com,b@bakimx.com" --region eu-central-1 --profile bakimx-prod
aws ecs update-service --cluster bakimx-prod-cluster --service bakimx-prod-app-svc \
  --force-new-deployment --region eu-central-1 --profile bakimx-prod
```

> **CDK uyarısı.** Task-def'in ve task execution rolünün asıl kaynağı CDK
> compute stack'idir ve o kaynak **bu repoda değildir**. CDK'da `ADMIN_EMAILS`
> hâlâ düz `environment` girdisi olarak duruyorsa bir `cdk deploy` bu bağlantıyı
> geri alır — o zaman yukarıdaki `put-parameter` yine sessizce etkisiz kalır.
> Kalıcı çözüm CDK kaynağında: değişkeni `secrets[]`e taşımak ve parametre
> okuma iznini task execution rolüne eklemek (bugün bu izin, CDK'nın kendi
> `...DefaultPolicy` politikasına dokunmamak için ayrı bir `AdminEmailsSsmRead`
> satır içi politikasıyla verilmiştir).

### Aşama 2 — müşteri portföyü kurumsallaştıkça

- Impersonation'da müşteri bilgilendirmesi; hassas tenant'a impersonation kilidi.
- Çeyreklik erişim gözden geçirmesi (kim hâlâ yönetici olmalı).

---

## 3. Karar 2 — Güvenlik boşlukları

MFA ve offboarding dışında, kodda doğrulanan üç nokta:

1. **Aktif impersonation oturumu iptal edilemiyor.** `ImpersonationSession.revokedAt`
   kolonu şemada var (`prisma/schema.prisma:1651`) ama koda hiç yazılmıyor. Oturumu
   yalnız başlatan kişi bitirebilir; 30 dakikalık süre dolana kadar üçüncü bir
   kişinin kesme yolu yok. Konsola "aktif oturumlar + iptal et" ekranı gerekiyor.
2. **Impersonation denetim kaydında görünmüyor.** `impersonation_started` /
   `impersonation_ended` yazılıyor (`impersonation-actions.ts:69,94`) ama denetim
   sayfasının etiket/filtre tablosunda yok (`audit/page.tsx:13`) — en hassas olay
   ne filtrelenebiliyor ne okunabilir etiketle görünüyor.
3. ~~**Rate limit process başına.**~~ **BAK-116 + BAK-195 + BAK-196 ile kapandı.** Sayaç
   artık Postgres'te (`RateLimitCounter`) tutuluyor ve tek deyimlik atomik
   artırımla güncelleniyor, yani eşik ECS task sayısıyla çarpılmıyor. Süreç-içi
   Map birinci kademe olarak duruyor: paylaşımlı depo erişilemezse istek
   reddedilmez (fail-open) ama bugünkü koruma taban olarak ayakta kalır.

   Dürüst kayıt: BAK-116 kütüphane katmanını ve çağıran uçların çoğunu taşıdı,
   ama iki public form ucu ile ziyaretçiye açık live-chat uçları kendi süreç-içi
   limiter'larıyla dışarıda kalmıştı; yani bu satır 20-08'e kadar onlar için
   doğru değildi. **BAK-195**, `/api/demo-request` ve `/api/support-request`
   uçlarını kanonik `rateLimit()`e taşıdı (`demo-request:<ip>` /
   `support-request:<ip>`, eşik aynen 3/dk/IP) ve regresyon testlerini ekledi.
   **BAK-196**, görüşme başlatma ve mesaj gönderme uçlarını kanonik sayaca taşıdı.
   Yoklama ucu (`GET /api/live-chat/messages`) bilerek süreç-içi kaldı
   (`rateLimitLocal`): panel açıkken 4 saniyede bir çalışıyor, yeni kayıt açmıyor
   ve yalnız kendi görüşmesini okuyor — paylaşımlı sayaç orada okunan işten
   pahalı bir yazma yükü üretirdi.

Ayrıca: repoda `robots.ts`/`robots.txt` yok. `/admin` anonim kullanıcıya 404
döndüğü için bu bir güvenlik açığı değil, ama `www.bakimx.com` için SEO tarafında
eksik.

---

## 4. Karar 3 — Yönetici paneli UI/UX

Bilgi mimarisi doğru: konsol "dikkat gerektirenler" ile açılıyor, sayaçlar
tıklanabilir, canlı destek rozeti her sayfada duruyor, mobilde yatay kaydırmalı
gezinme var. Bulgular bu temelin üzerindeki pürüzler:

| # | Bulgu | Kaynak | Etki |
|---|---|---|---|
| 1 | **İş Yerleri listesinde arama/filtre/sayfalama yok.** `getWorkshopRows()` tüm kayıtları çekip bellekte sıralıyor | `src/app/admin/data.ts:11` | Her destek görüşmesinin ilk adımı "müşteriyi bul" ve bugün bu adım Ctrl+F. 20 atölyede sorun değil, 200'de konsolun en sık kullanılan ekranı kullanılmaz olur |
| 2 | **Rol etiketleri bayat kopya:** `{owner:"Sahip", manager:"Yönetici", staff:"Personel"}` | `src/app/admin/workshops/[id]/page.tsx:33` | Kanonik kaynak `src/lib/roles.ts:12`. Sonuç: `usta`/`cirak` rolündeki üye ham enum olarak ("cirak") görünüyor ve `owner` panelde "Sahip", uygulamada "Yönetici" |
| 3 | **Durum rozetleri ham İngilizce:** `pending`, `trialing`, `past_due`, `canceled` | `admin-workshops.tsx:27,32` · `workshops/[id]/page.tsx:105,110` | Panelin geri kalanı Türkçe etiketli. Kurucular için sorun değil, işe alınacak destek personeli için gereksiz öğrenme yükü |
| 4 | **Yerel `Badge` kopyası iki dosyada tekrarlanıyor** | `admin-workshops.tsx:39` · `workshops/[id]/page.tsx:35` | `src/components/ui/badge.tsx` var ve 17 dosya onu kullanıyor. `ui-contract.test.ts` bunu yakalamıyor (ham `<span>` denetim kapsamında değil) |
| 5 | **Denetim kaydında tarih aralığı ve "yapan kişi" filtresi yok** | `audit/page.tsx` | Bir olayı geriye dönük araştırırken 50'lik sayfalarda gezmek gerekiyor |
| 6 | **Destek aksiyonu yok** | `src/app/admin/actions.ts` | Konsolda 12 aksiyon var; hepsi onay/plan/fatura/bayrak. Kilitli kalmış bir kullanıcı için "şifre sıfırlama bağlantısı gönder", "koltuğu aç/kapat", "sahibin e-postasını düzelt" yok — bu işler ya atölye sahibinden ya elle DB'den çözülüyor |

Bulgu 6'nın önemi: **destek süreci bugün konsolda bitmiyor.** Teşhis araçları
(impersonation, denetim, iletişim kaydı) iyi; müdahale araçları yok.

---

## 5. Karar 4 — Şikayet ve destek süreci

Bugünkü kanallar ve boşlukları:

| Kanal | Model | Boşluk |
|---|---|---|
| Canlı destek widget'ı | `LiveChatConversation` — konsoldan yanıtlanabiliyor, yanıt bekleyen sayacı var | — |
| Destek formu | `SupportRequest` — yalnız `status` (new/in_progress/resolved/archived) | Atanan kişi, iç not, konsoldan yanıt **yok**; hangi iş yerine ait olduğu **kayıtlı değil** (`workshopId` kolonu yok) → şikayeti tenant'la elle eşleştiriyorsunuz |
| Demo talebi | `DemoRequest` | Aynı — satış hunisi alanı yok |

Öneriler:

1. **`SupportRequest`'e `workshopId`, `assignedToEmail` ve iç not ekleyin.** Şikayeti
   tenant'a bağlamak, teşhisin ilk yarısını ortadan kaldırır.
2. **İlk yanıt süresi ölçün.** Bugün ölçülmüyor; hedef koymadan önce ölçmek gerekir.
3. **Test yöntemi — prod'da müşteri verisiyle deneme yapmayın.** `app-dev.bakimx.com`
   üzerinde kalıcı bir **destek test kiracısı** tutun ve şikayeti orada üretin.
   Prod'da yalnız salt-okunur impersonation kullanılır. Ayrıntılı triyaj adımları:
   [support-runbook.md](./support-runbook.md).

---

## 6. Gündeme gelmemiş ama gerekli olanlar

- **Offboarding tatbikatı.** Konsol erişimini kesmek artık `/admin/admins` →
  "Erişimi kapat" (açık oturum dahil, deploy yok — BAK-93). Geriye kalan adımlar
  hâlâ elle: uygulama hesabının kendisi (`User.isActive`), prod DB / AWS erişimi
  ve varsa paylaşılan sırlar. Bunları bir kez uçtan uca deneyin.
- **Break-glass / prod veritabanı erişimi.** `scripts/prod-reset.ts` ve SSM tüneliyle
  prod'a doğrudan erişim mümkün. Kimin, ne zaman, hangi gerekçeyle bağlandığının
  kaydı yok. En az: her prod DB oturumu için yazılı gerekçe + sonrasında bildirim.
- **KVKK / veri işleyen sıfatı.** Hukuki sayfalar mevcut (`/kvkk`, `/privacy`,
  `/terms`, `/acik-riza`). Eksik olan iç taraf: personelin müşteri verisine erişimi
  neye dayanıyor, saklama süreleri ne, veri ihlali bildirimi nasıl işliyor.
  Impersonation kaydı bu dosyanın en güçlü delili — kullanın.
- ~~**Yedekten geri dönüş provası.**~~ **Kapandı (BAK-120, 2026-08-19.)** İlk
  tatbikat yapıldı — prod snapshot'ından geçici bir instance'a geri yükleme
  6 dk 58 sn'de tamamlandı ve doğrulandı. Prosedür, RTO/RPO hedefleri, tatbikat
  kaydı ve kalan boşluklar (bölge kaybı, statü sayfası):
  [disaster-recovery.md](./disaster-recovery.md).
- **Olay iletişimi.** ~~Kesinti olduğunda müşteriye ne söyleneceği ve nereden
  söyleneceği tanımlı değil (statü sayfası yok).~~ BAK-119 ile interim çözüm
  teslim edildi: [x.com/bakimxcom](https://x.com/bakimxcom), `hey@bakimx.com`
  yönetiyor, hazır anons şablonları
  [incident-communication.md](./incident-communication.md). Dahili `/status`
  sayfası (geçmiş olay arşivi + konsoldan güncelleme) BAK-128'de backlog'da.
- **`security@bakimx.com`.** `SECURITY.md` bu adresi ve "makul sürede dönüş"ü vaat
  ediyor — kutunun gerçekten okunduğundan emin olun.
- **www içerik yönetimi.** Landing metinleri kodda; her metin değişikliği bir deploy.
  Canlı destek ayarları (`LiveChatSettings`) DB'de tutuluyor ve konsoldan
  düzenlenebiliyor — pazarlama metinleri için de izlenecek doğru örnek bu.

---

## 7. Öncelik sırası

| Öncelik | İş | Gerekçe |
|---|---|---|
| **P0** | **`/admin` için Google Workspace SSO** | Tüm kiracı verisinin tek kapısı bugün tek faktörlü — **kod BAK-94 ile geldi, yapılandırma bekliyor (§8)** |
| ~~P0~~ | ~~`ADMIN_EMAILS` → DB tablosu + admin rolleri~~ | **BAK-93 ile geldi** — §2 |
| **P1** | İş yeri listesinde arama + sayfalama | Destek akışının ilk adımı |
| **P1** | Aktif impersonation ekranı + iptal (`revokedAt`) | Şemada var, kodda yok |
| **P1** | Impersonation olaylarını denetim filtresine/etiketlerine ekle | En hassas olay bugün görünmüyor |
| **P1** | Konsoldan şifre sıfırlama bağlantısı gönderme | Destek bugün konsolda bitmiyor |
| ~~P2~~ | ~~Rate limit'i paylaşımlı sayaca taşı~~ | **BAK-116** (kütüphane + uçların çoğu) + **BAK-195** (demo/destek form uçları) + **BAK-196** (live-chat yazma uçları) ile geldi — §3.3 |
| **P2** | `SupportRequest`: `workshopId` + atama + iç not | Şikayet ↔ kiracı bağı |
| **P2** | Etiket/rozet temizliği (§4 / 2-3-4) | Tutarlılık; yeni personelin öğrenme yükü |
| **P3** | Çeyreklik erişim gözden geçirmesi, statü sayfası | Portföy büyüdükçe |

### İkinci faktör kararı: TOTP değil SSO (2026-08-17)

Bu dokümanın ilk hâli P0'ı **TOTP** yazıyor, Google Workspace SSO'yu P3'e
koyuyordu. Karar SSO yönünde değişti; ikisi de ikinci faktörü çözdüğü için sıraya
ikisini birden koymak yanlış olurdu.

Gerekçe: TOTP yalnız **giriş anını** güçlendirir, üyeliği hâlâ BakımX yönetir —
işten ayrılan biri için TOTP kaydını, hesabını ve `PlatformAdmin` satırını ayrı
ayrı kapatmak gerekir. Google Workspace SSO offboarding'i **tek noktaya** indirir:
Workspace hesabı kapandığında konsol girişi de kapanır. BakımX personeli zaten
Workspace kullanıyor, yani ikinci faktör (Workspace'in kendi 2FA'sı) ücretsiz
gelir ve yeni bir sır saklama yükü doğmaz.

BAK-93 bunun **ilk halkasıdır**: SSO da bir `PlatformAdmin` satırına ve bir role
bağlanacak; env allowlist'i üstünde SSO kurmak mümkün değildi. Sıra artık
"kimlik sağlayıcı" katmanında.

---

## 8. Google Workspace SSO — kurulum ve açık maddeler (BAK-94)

Kod `dev`'de. **Yapılandırma yapılmadığı sürece SSO KAPALIDIR** ve bu bilinçlidir:
`GOOGLE_OIDC_CLIENT_ID` / `GOOGLE_OIDC_CLIENT_SECRET` yoksa `/admin-login` ekranı
düğmeyi hiç çizmez, `/api/auth/admin/google/*` 404 döner ve durum
`[admin-sso]` önekiyle loglanır. Sessizce şifre girişine düşmez.

### 8.1 Ne çalışıyor

| Kontrol | Nerede |
|---|---|
| Yetkilendirme isteği: `state` + `nonce` + PKCE (S256), el sıkışma şifreli tek kullanımlık çerezde | `src/lib/admin-sso.ts`, `src/lib/admin-sso-cookie.ts` |
| Kimlik jetonu doğrulaması: JWKS imzası, `iss` / `aud` / `exp`, `nonce`, `email_verified`, `hd` | `verifyGoogleIdToken()` |
| **Otomatik hesap açma YOK** — `User` **ve** etkin `PlatformAdmin` satırı şart, kullanıcı hesabı yaratılmaz | `resolveSsoAdmin()` |
| Üyelik kararı şifreli yolla ORTAK; boş tabloda `ADMIN_EMAILS` bootstrap'ı SSO'da da çalışır (BAK-114) | `resolveAdminMembership()` |
| Oturum: mevcut `establishSession()` — `authenticatedAt` damgası basılır | `src/app/api/auth/admin/google/callback/route.ts` |
| Oturum iptali: `PlatformAdmin.sessionsValidFrom` SSO oturumlarında da geçerli (ikinci mekanizma yok) | `src/lib/admin.ts` |
| Reddedilen deneme denetim kaydı (`platform_admin_sso_rejected`) | callback route |
| Bootstrap ile açılan ilk giriş ayrı olay: `platform_admin_sso_bootstrap` | callback route |

**`hd` neden sunucuda:** yetkilendirme isteğine `hd=bakimx.com` eklemek bir filtre
değil, yalnız hesap seçicideki ipucudur — kişisel bir Gmail ile gelmeyi engellemez.
Kapı kimlik jetonundaki `hd` + e-posta alan adı kontrolüdür. Testler:
`src/lib/admin-sso.test.ts` (yerel anahtar çiftiyle, gerçek Google'a çıkmadan).

**Denetim kaydının sınırı:** `AuditLog.workshopId` zorunlu olduğu için yalnız bir
kiracıya bağlanabilen (yani `User` satırı olan) reddedilmiş denemeler tabloya
yazılabilir. Hiç kullanıcı satırı olmayan bir `bakimx.com` denemesi yalnız sunucu
logunda kalır. Platform seviyesinde denetim tablosu ayrı bir iştir.

### 8.2 Yapılandırma (kodla teslim edilemez)

1. Google Cloud → **APIs & Services → OAuth consent screen**: User type **Internal**.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
   Kayıtlı redirect URI'lar birebir şunlar olmalı:
   - `http://localhost:3000/api/auth/admin/google/callback`
   - `https://app-dev.bakimx.com/api/auth/admin/google/callback`
   - `https://app.bakimx.com/api/auth/admin/google/callback`

   Prod'da konsol `app.bakimx.com` host'unda yaşadığı için callback adresi
   landing host'undan gelen isteklerde de oraya kanonikleştirilir
   (`resolveRedirectUri`); `bakimx.com` için ayrı URI kaydına gerek yoktur.
3. Değerler ortam değişkeni olarak gelir — repoya yazılmaz:
   - `GOOGLE_OIDC_CLIENT_ID` → SSM (`/bakimx/<env>/GOOGLE_OIDC_CLIENT_ID`)
   - `GOOGLE_OIDC_CLIENT_SECRET` → Secrets Manager (`bakimx/<env>/google-oidc-client-secret`)
   - `GOOGLE_OIDC_HD` (opsiyonel, varsayılan `bakimx.com`)
4. **ECS taskdef/CDK bağlaması ayrı bir PR'dır ve parametreler yazıldıktan SONRA
   yapılır.** Var olmayan bir SSM parametresini taskdef'e `secrets` olarak eklemek
   task'ın hiç başlamamasına yol açar.

### 8.3 Break-glass erişimi

Google Workspace veya OAuth yapılandırması kullanılamadığında tek kurtarma yolu
`breakglass@bakimx.com` hesabıdır. Bu adres yalnız kimliği belirler; yetki yine
etkin `PlatformAdmin` satırından gelir. Hesabın sahibi `alpkaan@bakimx.com` ve
başka yetkili yoktur. BakımX parolası Google Workspace'ten bağımsız, çevrimdışı
bir dosyada tutulur; dosya bulut eşitlemesine alınmaz ve parola issue, sohbet,
log veya repo içeriğine yazılmaz.

**Kullanım yordamı:**

1. Yalnız Google SSO ile `/admin` erişimi kesildiğinde olay ve gerekçe kaydedilir.
2. `/login` ekranında `breakglass@bakimx.com` ve çevrimdışı kopyadaki BakımX
   parolası kullanılır. Başarılı giriş denetimde
   `platform_admin_break_glass_login` olarak ayrı görünür.
3. Sorun giderildikten sonra Google SSO ile normal giriş doğrulanır.
4. Break-glass parolası hemen değiştirilir ve çevrimdışı kopya yeni parolayla
   güncellenir. Eski kopya güvenli biçimde imha edilir.
5. `/admin/admins` üzerinden break-glass hesabının **Oturumları kapat** işlemi
   çalıştırılır; `sessionsValidFrom` önceki oturumları bir sonraki istekte geçersiz
   kılar. Denetim kaydında hem acil giriş hem oturum iptali kontrol edilir.

Hesap ve çevrimdışı kopya üç ayda bir prova edilir: parola girişinin çalıştığı,
ayrı denetim olayının oluştuğu ve oturum iptalinin açık sekmeyi kapattığı
doğrulanır; prova bitince parola yine döndürülür.

**Workspace 2SV:** 19 Ağustos 2026'da workspace sahibi, tüm kullanıcılar için
2 Adımlı Doğrulama zorunluluğunu açtığını teyit etti. Bu dış konsol ayarı repodan
bağımsızdır; çeyreklik provada açık olduğu ayrıca kontrol edilir.

Normal platform yöneticilerinin parola oturumu atölye uygulamasında geçerli kalsa
da `/admin` yetkisi vermez. Konsol yalnız `google_sso` damgalı oturumu veya
`breakglass@bakimx.com` hesabının parola oturumunu kabul eder. Eski, yöntem damgası
taşımayan oturumlar fail-closed reddedilir. Localhost QA için `/api/auth/dev-login`
ayrı `development` damgası taşır ve production ortamında zaten kapalıdır.

---

## Kaynaklar

Kurumsal pratik tarafındaki iddialar şu kaynaklara dayanıyor:

- [Secure admin impersonation for support with consent and audits — AppMaster](https://appmaster.io/blog/secure-admin-impersonation-controls-audit-scope)
- [How to Build a Safe User Impersonation Tool for SaaS Support and Ops Teams — Yaro Labs](https://yaro-labs.com/blog/user-impersonation-tool-saas)
- [What should teams do when support needs to impersonate enterprise users? — NHI Mgmt Group](https://nhimg.org/faq/what-should-teams-do-when-support-needs-to-impersonate-enterprise-users/)
- [SOC 2 Checklist for SaaS Startups — Comp AI](https://trycomp.ai/soc-2-checklist-for-saas-startups)
- [The complete guide to user management for B2B SaaS — WorkOS](https://workos.com/blog/user-management-for-b2b-saas)
- [How to manage SaaS user access permissions — BetterCloud](https://www.bettercloud.com/monitor/effectively-managing-saas-user-access-permissions/)
