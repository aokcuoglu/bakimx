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
| Üyelik | `PlatformAdmin` tablosu (BAK-93). `ADMIN_EMAILS` yalnız tablo boşken çalışan bootstrap yolu; ikisi de boşsa konsol **herkese 404** | `src/lib/admin.ts` |
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
| `manageFlags` | ✅ | — | — | — |
| `manageCatalog` | ✅ | — | — | — |
| `manageLiveChat` | ✅ | ✅ | — | — |
| `viewAudit` | ✅ | ✅ | ✅ | ✅ |
| `viewHealth` | ✅ | ✅ | — | ✅ |
| `exportData` | ✅ | — | ✅ | — |
| `manageLeads` (demo/destek talebi durumu) | ✅ | ✅ | — | — |
| `manageAdmins` (bu liste) | ✅ | — | — | — |

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
3. **Rate limit process başına.** `src/lib/rate-limit.ts:1` bellek içi bir Map;
   dosyanın kendi notu da bunu söylüyor. ECS'te birden fazla task koştuğunda —
   rolling deploy sırasında **her zaman** en az iki task olur — etkin eşik task
   sayısıyla çarpılır. Paylaşımlı bir sayaca (Redis/Postgres) taşınmalı.

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
- **Yedekten geri dönüş provası.** RDS snapshot alınıyor; **geri dönüş hiç denenmedi**.
  Denenmemiş yedek yedek değildir.
- **Olay iletişimi.** Kesinti olduğunda müşteriye ne söyleneceği ve nereden
  söyleneceği tanımlı değil (statü sayfası yok).
- **`security@bakimx.com`.** `SECURITY.md` bu adresi ve "makul sürede dönüş"ü vaat
  ediyor — kutunun gerçekten okunduğundan emin olun.
- **www içerik yönetimi.** Landing metinleri kodda; her metin değişikliği bir deploy.
  Canlı destek ayarları (`LiveChatSettings`) DB'de tutuluyor ve konsoldan
  düzenlenebiliyor — pazarlama metinleri için de izlenecek doğru örnek bu.

---

## 7. Öncelik sırası

| Öncelik | İş | Gerekçe |
|---|---|---|
| **P0** | **`/admin` için Google Workspace SSO** | Tüm kiracı verisinin tek kapısı bugün tek faktörlü |
| ~~P0~~ | ~~`ADMIN_EMAILS` → DB tablosu + admin rolleri~~ | **BAK-93 ile geldi** — §2 |
| **P1** | İş yeri listesinde arama + sayfalama | Destek akışının ilk adımı |
| **P1** | Aktif impersonation ekranı + iptal (`revokedAt`) | Şemada var, kodda yok |
| **P1** | Impersonation olaylarını denetim filtresine/etiketlerine ekle | En hassas olay bugün görünmüyor |
| **P1** | Konsoldan şifre sıfırlama bağlantısı gönderme | Destek bugün konsolda bitmiyor |
| **P2** | Rate limit'i paylaşımlı sayaca taşı | Çok task'lı ECS'te eşik çarpılıyor |
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

## Kaynaklar

Kurumsal pratik tarafındaki iddialar şu kaynaklara dayanıyor:

- [Secure admin impersonation for support with consent and audits — AppMaster](https://appmaster.io/blog/secure-admin-impersonation-controls-audit-scope)
- [How to Build a Safe User Impersonation Tool for SaaS Support and Ops Teams — Yaro Labs](https://yaro-labs.com/blog/user-impersonation-tool-saas)
- [What should teams do when support needs to impersonate enterprise users? — NHI Mgmt Group](https://nhimg.org/faq/what-should-teams-do-when-support-needs-to-impersonate-enterprise-users/)
- [SOC 2 Checklist for SaaS Startups — Comp AI](https://trycomp.ai/soc-2-checklist-for-saas-startups)
- [The complete guide to user management for B2B SaaS — WorkOS](https://workos.com/blog/user-management-for-b2b-saas)
- [How to manage SaaS user access permissions — BetterCloud](https://www.bettercloud.com/monitor/effectively-managing-saas-user-access-permissions/)
