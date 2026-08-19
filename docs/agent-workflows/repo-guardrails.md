# Repo tuzakları — birikimden çıkan kurallar

Bu dosya, BakımX'te **birden çok kez tekrarlanan** hataların kuralları. Her madde
bir PR/commit veya kaynaktaki bir testle gerekçelendirilmiştir; kaynağı olmayan
kural buraya yazılmaz. Teslimat akışının tamamı için
[issue-delivery.md](./issue-delivery.md), komutlar ve tech stack için
[`AGENTS.md`](../../AGENTS.md).

## 1. Kalite kapısı: dört komut, tek sıra

CI (`quality` işi) tam olarak şunları koşar — lokalde de aynısını koş
([`.github/workflows/quality.yml`](../../.github/workflows/quality.yml):48-58):

```sh
bun test
bun run lint
bun run typecheck
bun run build      # SESSION_SECRET gerektirir
```

`bun run lint` **uyarıyla değil, hatayla** düşer; mevcut uyarı sayısını
artırmamak yeterli değil, sıfır hata gerekir. Lint hatası yüzünden bloke olmuş
PR'lar iki kez ayrı temizlik PR'ı gerektirdi (PR #347, PR #351).

**Bilinen bastırma:** react-hook-form `form.watch()` React Compiler tarafından
memoize edilemiyor ve `react-hooks/incompatible-library` hatası veriyor. Bu
kullanım güvenli; dosya başına `eslint-disable` yorumu ile bastırılır (PR #347 —
`working-hours-form.tsx`, `communication-settings-form.tsx`,
`vehicle-create-form.tsx`, `supplier-form.tsx`). Yeni bir form eklerken aynı
deseni kullan, kuralı `eslint.config` seviyesinde kapatma.

## 2. Dallar kısmen korumalı — neyin kapalı, neyin açık olduğunu bil

2026-08-17'de GitHub Pro alındı (Actions dakikası bitince, BAK-86) ve branch
protection **açıldı** (BAK-89). Öncesinde API `403` dönüyordu; bu dosyanın eski
sürümündeki "hiçbir dal korumalı değil" ifadesi artık geçersiz.

| | `main` | `dev` |
|---|---|---|
| Silme | ❌ engelli (**admin dahil**) | ❌ engelli (**admin dahil**) |
| Force push | ❌ engelli (**admin dahil**) | ❌ engelli (**admin dahil**) |
| PR zorunlu | ✅ 0 onay | — açık |
| `quality` check zorunlu | ✅ | — |
| Dalın güncel olması (`strict`) | ✅ açık | — |
| Admin bypass (`enforce_admins`) | ❌ kapalı | ❌ kapalı |

Tablodaki iki satır **varsayılmadı, ölçüldü** (2026-08-17, BAK-89). Tek kullanımlık
bir `tmp-*` dalına aynı kural seti uygulanıp depo sahibinin token'ıyla denendi:

```
DELETE /git/refs/heads/tmp-*   → 422 "Cannot delete this branch"
PATCH  ... force=true          → 422 "Cannot force-push to this branch"
```

Aynı test `enforce_admins: false` iken de tekrarlandı ve **yine 422** döndü — yani
silme/force-push yasağı admin muafiyetinden bağımsız olarak herkese uygulanıyor.
`enforce_admins` bu ikisini değil, **PR ve `quality` zorunluluğunu** admin için de
bağlayıcı yapar.

Kararların gerekçesi:

- **`main`'de admin bypass kapalı** — §2.3'teki olay (30-07'de `main`'e PR'sız iki
  commit, ikisi de sessizce prod'a çıktı) artık *alarm* değil **duvar**. Hotfix yolu
  kapanmıyor: [`releasing.md`](../releasing.md) §Hotfix zaten "main'den dallan,
  main'e PR aç, merge et" diyor — yani belgeli akış hiçbir zaman doğrudan push
  değildi. Gerçekten çaresiz kalınırsa admin korumayı 10 saniyede kapatabilir ve bu
  iz bırakır; sessiz bir push iz bırakmıyordu.
- **`main`'de `strict` açık** — `main`'e yalnız release PR'ı geliyor, yani "açık tüm
  PR'lar yeniden `quality` koşar" maliyeti burada pratikte sıfır (kıyas: `dev`'e ayda
  onlarca PR). Karşılığında release PR'ı `main`'i tam olarak içermeden merge
  edilemiyor — `main`'e girmiş bir düzeltmeyi sessizce geri alan bir sürüm mümkün değil.
- **`dev`'de PR/check zorunlu değil** — `sync-main-to-dev.yml` `dev`'e **doğrudan**
  push ediyor (release sonrası `main`'i geri merge'ler). Hem PR zorunluluğu hem
  zorunlu status check bu push'u reddeder ve her release sonrası sync'i kırar.
  Kapatılabilir (`bypass_pull_request_allowances` ile `github-actions` uygulamasına
  muafiyet), ama kazancı düşük: ajanlar zaten PR ile giriyor ve PR'sız bir commit'in
  **ship edilmesi** `pr-origin` kapısıyla engelli (§2.4). Bilinçli açık kutu.

Ortadan kalkan risk: **dal silme, force push ve `main`'e PR'sız push**. Geriye kalan
risk: `dev`'e PR'sız push (ship edilemez) ve `dev`'e açılan PR'larda **bayat dal** —
onun panzehiri hâlâ §2.1'deki disiplin.

### 2.1 Yeşil tik merge sonucunu kanıtlamaz

Yeşil tik yalnız PR head'inin yeşil olduğunu söyler, `dev` ile birleşmiş halinin
değil. Deploy workflow'ları bu yüzden kapıyı ship edecekleri commit'e karşı
yeniden koşar. Bunun bedeli iki kez ödendi:

- **PR #338**, PR #334'ün eklediği `WorkshopEntryQR` çağrısını bayat bir dal
  üzerinden squash merge ederek düşürdü; bileşen dosyaları repoda kaldı ama hiç
  render edilmedi. PR #341 (BAK-54) geri getirdi.
- **PR #339** uygulama kodunda `BakimxOrder` modellerini kullanıyordu ama Prisma
  şeması ve migration'ı PR'da yoktu; `dev` üzerinde build kırıldı ve teslimat
  PR #343 ile komple revert edildi.

Kural: push'tan önce `git fetch origin dev && git merge origin/dev`, sonra
kapıları **birleşmiş hal üzerinde** tekrar koştur. Merge öncesi
`git diff origin/dev --stat` çıktısını oku — dokunmadığın bir dosya siliniyorsa
dalın bayattır.

### 2.2 `.githooks/pre-push` caydırıcıdır, engelleyici değildir

`.githooks/pre-push` `dev` ve `main`'e doğrudan push'u reddeder ve `postinstall`
`core.hooksPath=.githooks` yazar — ama bu bir koruma değil, kas hafızası
düzeltmesidir. Üç yoldan atlanır: `git push --no-verify`, `ALLOW_DIRECT_PUSH=1`,
ve `bun install` hiç çalışmamış bir checkout (hook kayıtlı değildir). Ayrıca
GitHub web arayüzünden yapılan düzenleme/merge hook'u hiç görmez. "Hook var" bir
dalın korunduğu anlamına **gelmez**.

### 2.3 PR'sız `main` push'u artık engelli — alarm ikinci katman

> **17-08 güncellemesi (BAK-89):** `main` artık PR zorunlu ve admin muafiyeti
> kapalı, yani aşağıda anlatılan push sınıfı **gerçekleşmeden** reddediliyor.
> `main-push-guard.yml` silinmedi (maliyeti ~1 dk/push): geriye kalan tek yol —
> korumayı elle kapatıp push edip geri açmak — hâlâ alarm verir. Yani bu guard'ın
> kırmızıya dönmesi bugün "birisi korumayı kapattı" demektir.

30-07'de `main`'e PR'sız iki commit girdi (`3079291`, `3f038e7`); ikisi de prod
deploy'u tetikledi ve **kimse haberdar olmadı**.
[`main-push-guard.yml`](../../.github/workflows/main-push-guard.yml) bu sessizliği
kapatır: `main`'e her push'ta commit'in bir PR'dan gelip gelmediğini sorar
(`commits/<sha>/pulls`), gelmemişse run'ı **kırmızıya düşürür** ve tek seferlik
bir issue açar.

Ne yaptığı konusunda dürüst ol: bu **engelleme değil, bildirimdir**. Commit dala
çoktan girmiştir ve prod deploy'u çoktan başlamıştır; alarm olaydan *sonra* haber
verir. `paths-ignore` bilinçli olarak yoktur — 30-07'deki push'lar `.yml`
dosyalarıydı, bir doküman filtresi tam da yakalaması gereken sınıfı kaçırırdı.
Ayrıca `push` olayında workflow'un **pushlanan commit'teki** sürümü çalışır, yani
guard'ı aynı doğrudan push'ta silen biri yakalanmaz.

### 2.4 PR'sız commit dev veya prod'a çıkamaz

Alarm haber verir, kapı durdurur:
[`deploy-dev-aws.yml`](../../.github/workflows/deploy-dev-aws.yml) ve
[`deploy-prod-aws.yml`](../../.github/workflows/deploy-prod-aws.yml) içindeki
`pr-origin` job'ları, kendi `deploy` job'larının `needs`'inde. `dev` veya `main`'e
gelen commit bir merged PR'a bağlı değilse ilgili deploy **başlamadan düşer**
(alpkaan onayı, 2026-08-15; BAK-59 ve BAK-62).

Bu da dalları korumaz — commit `dev` veya `main`'de kalır, yalnız ship edilmez.
Ve bilinçli bir kaçış yolu var: PR kontrolünün `if`'i job seviyesinde değil **adım**
seviyesindedir, yani `workflow_dispatch` ile elle çalıştırıldığında job sıfır adımla
yeşil geçer. Gerçek bir hotfix'te prod'a çıkmanın hiçbir yolunun kalmaması kapının
kendisinden büyük risk; elle çalıştırma zaten iz bırakır (kim başlattı Actions'ta
görünür) ve `main-push-guard` yine kırmızıdır. **Bu adım-seviyesi `if`'i job
seviyesine taşıma**: o zaman dispatch sırasında job *skipped* olur ve ona bağlı
`deploy` da atlanır.

Karıştırma: `deploy-dev-aws.yml`'de bu adım-seviyesi `if`'in yanında bir de
**job-seviyesi** `if` var (`[deploy-dev]` işaretçisi, §6). İkisi farklı işler
yapıyor ve birleştirilemez — ayrıntı workflow'un kendi yorumunda.

### 2.5 Release merge'ünde `dev`'i SİLME — silinirse otomatik geri gelir

15-08'de release PR'ı ([#364](https://github.com/aokcuoglu/bakimx/pull/364),
`dev -> main`) merge edilirken head dalı **elle** silindi. Repo ayarı suçlu
değil: `delete_branch_on_merge` zaten `false`; silme merge ekranındaki "Delete
branch" düğmesine basılmasıydı. `dev` bir issue dalı değil, **kalıcı entegrasyon
dalıdır** — release'den sonra da yaşamaya devam eder.

Bedeli tek bir dal kaydından ibaret değildi, zincirleme oldu:

- ajanlar dallanacak tabanı kaybetti (`issue/*` dalları `origin/dev`'den açılır),
- `deploy-dev-aws.yml` (`push: dev`) bir daha tetiklenemez hale geldi, yani
  `app-dev.bakimx.com` deploy alamaz oldu,
- `sync-main-to-dev.yml` aynı dakikada düştü (18:44, `a95f453`):
  `actions/checkout` `ref: dev` bulamadı.

İçerik kaybı olmadı — release `dev`'i `main`'e merge ettiği için `main`'in ağacı
`dev`'in son commit'iyle (`42467e3`) byte-byte aynıydı; dal `main`'den geri
yaratıldı.

**Aynı hata 17-08'de tekrarlandı** (PR [#384](https://github.com/aokcuoglu/bakimx/pull/384),
v0.14.0 release merge'ü) — ve bu kez onarım da çalışmadı: `dev-branch-guard.yml`
de bir Actions job'ı, arızalı olan da Actions'ın kendisiydi (ücretsiz dakika
kotası dolmuştu, BAK-86). **Onarım mekanizması onardığı şeyle aynı tek arıza
noktasına bağlıydı.** `dev` elle, `main`'den geri yaratıldı (ağaç hash'i birebir
aynıydı, içerik kaybı yine yok).

İki olaydan sonra kalıcı çözüm kondu: **17-08 itibarıyla silme sunucu tarafında
engelli** (§2 — `allow_deletions: false`, admin dahil). Yani bu artık *olamaz*.
[`dev-branch-guard.yml`](../../.github/workflows/dev-branch-guard.yml) yine
duruyor (`delete` olayında `dev`'i `main`'den yeniden yaratır ve bir issue açar)
ama artık **ikinci savunma hattı**, birinci değil — koruma elle kapatılırsa diye.

Dürüst ol: guard bir **engelleme değil, onarımdır** ve iki koşulda işe yaramaz —
Actions bloke olduğunda ve silme ile geri gelme arasındaki pencerede açılmış bir
PR hedefini kaybettiğinde. Kural hâlâ geçerli: release merge'ünde o düğmeye basma.

## 3. Şema ve onu kullanan kod aynı PR'da gider

Yeni bir Prisma modeli/alanı kullanan kod, `prisma/schema.prisma` değişikliği ve
`prisma/migrations/` altındaki migration ile **aynı PR'da** olmalı (PR #343 kök
neden bölümü). `bun run db:push` bir teslimat aracı değildir, yalnız lokal
prototipleme içindir ([`AGENTS.md`](../../AGENTS.md):15).

Aynı revert'in ikinci bulgusu: dinamik rota klasörü literal `\[id\]` adıyla
eklenmişti. Dinamik segment klasörleri kabuk kaçışı olmadan `[id]` yazılır.

## 4. Birim testi `*.test.ts`, e2e testi `*.e2e.ts`

Playwright'ın varsayılan `*.spec.ts` deseni `bun test`in topladığı desenle
kesişiyor ve `bun test`i "Playwright Test did not expect test() to be called
here" ile düşürüyor — `dev` ve ona açılan tüm PR'lar kırmızı olmuştu (PR #306).
Ayrım artık [`playwright.config.ts`](../../playwright.config.ts):7-10 içinde
sabit: e2e testleri `*.e2e.ts` ile bitmek zorunda.

## 5. Kaynak tarayan regresyon kapıları

Bu testler davranışı değil **kaynak kodun kendisini** tarar. Bir kuralı ihlal
eden yeni kod, ilgili ekranı hiç açmadan `bun test` ile kırmızıya düşer. Yeni
kod yazmadan önce hangisinin kapsamına girdiğine bak:

| Test | Neyi engeller |
|---|---|
| `src/lib/ui-contract.test.ts` | Yönetim yüzeylerinde (`admin`, `analytics`, `reports`, `settings`) ham `<button>/<input>/<select>/<textarea>` ve sabit `text-red-500` tipi renkler |
| `src/lib/theme-tokens.test.ts` | `@theme` içinde tanımı olmayan renk token'ı (Tailwind sessizce hiç kural üretmez — PR #241) ve WCAG AA altındaki kontrast |
| `src/components/ui/control-sizing.test.ts` | Mobil 44px / `md+` 36px kontrol matrisinin bozulması — bkz. [ui-control-sizing.md](../ui-control-sizing.md) |
| `src/components/ui/tabs-overflow.test.ts` | Kaydırılabilir sekme şeridinde düz `justify-center` (taşan şeritte ilk sekme erişilemez oluyor — #277) |
| `src/lib/rbac-coverage.test.ts` | Yetki kapısını hiç çağırmayan yeni mutasyon action'ı (#183) |
| `src/lib/intake/photo-visibility.test.ts` | Fotoğraf okuyan sorguda `VISIBLE_PHOTO` filtresinin unutulması — soft-delete edilmiş kare galeride/PDF'te geri görünür |
| `src/lib/test-mock-isolation.test.ts` | Kendi test dosyası olan bir modülün `mock.module` ile sahtelenmesi — sahte süreç geneli kalıcıdır ve asıl testi dosya sırasına göre düşürür (§7) |

`rbac-coverage`, `photo-visibility` ve `test-mock-isolation` bilinçli istisnalar için gerekçeli bir
allowlist tutar. İstisna gerekiyorsa oraya **gerekçesiyle** ekle; testi gevşetme
ya da taramayı daraltma.

## 6. `dev`'e merge app-dev'e deploy ETMEZ — `[deploy-dev]` yaz

17-08'den beri [`deploy-dev-aws.yml`](../../.github/workflows/deploy-dev-aws.yml)
**opt-in**: `dev`'e giden push yalnızca head commit mesajında `[deploy-dev]`
geçerse deploy eder, yoksa tüm job'lar `skipped` olur ve **0 dakika** faturalanır
(alpkaan onayı, 2026-08-17; BAK-90). Elle çalıştırma her zaman deploy eder:
Actions → *Deploy to AWS dev* → Run workflow.

Neden: bu tek workflow 17 günde 125 run ve faturanın **%73'ü**ydü (her run 16
faturalanabilir dakika, 11'i arm64 build). Ücretsiz kota bunun için doldu ve
v0.14.0'ın prod deploy'unu saatlerce bloke etti (BAK-86). app-dev'e günde 7 kez
ihtiyaç yok — QA izole worktree'de lokal/tünelli DB ile yapılıyor, app-dev'in
asıl işi sürüm öncesi paylaşımlı doğrulama.

Squash mesajına işaretçiyi ne zaman ekleyeceksin:

| Durum | İşaretçi |
|---|---|
| PR yeni bir **migration** içeriyor | **ZORUNLU** — dev DB'sine `migrate deploy` yalnız bu deploy içinde koşar; unutulursa app-dev şeması koddan geri kalır |
| Değişikliği paylaşımlı ortamda birinin görmesi gerekiyor | ekle |
| Sürüm öncesi doğrulama turu | ekle (ya da elle dispatch) |
| Sıradan feature/fix PR'ı, QA worktree'de yapıldı | **ekleme** |

app-dev'in bayat kalması normaldir ve bir arıza değildir; sürüm öncesi zaten elle
deploy ediliyor ([releasing.md](../releasing.md) §Sürüm çıkarma adım 2).

## 7. `mock.module` süreç geneli ve KALICI — geri alınamaz

`bun test` tüm dosyaları tek süreçte koşar. `mock.module("X", …)` bir dosyada
çağrıldığında X'in kayıt defterindeki girdisi **kalıcı olarak** değişir; dosya
bittiğinde geri alınmaz ve `mock.restore()` bunu kapsamaz. Sonuç: X'i asıl test
eden dosya, sahteleyen dosyadan SONRA çalışırsa gerçek modül yerine sahteyi alır.

Bu bir sıra kumarıdır: dosya keşif sırası platforma göre değişir. 19-08'de
[PR #427](https://github.com/aokcuoglu/bakimx/pull/427) lokalde 1580/1580 yeşilken
CI'da `src/lib/push/send.test.ts`'in **dördü de** düştü — `push-dispatch.test.ts`
`@/lib/push/send`'i sahteliyordu ve CI'da ondan önce koşuyordu. Dört testin de
aldığı `{sent: 1, failed: 0, removed: 0}` sahtenin sabit dönüş değeriydi.

Kural: **kendi test dosyası olan bir modülü sahteleme.** Sahtelemek istediğin şey
test ettiğin şeyse, kodu ayır — BAK-129'da alıcı çözümlemesi
(`resolveTechnicianPushDelivery`) gönderimden ayrıldı ve test artık
`@/lib/push/send`'i hiç yüklemiyor. `src/lib/test-mock-isolation.test.ts` bunu
tarar; gerçekten gerekiyorsa allowlist'e gerekçesiyle ekle.

Lokalde tek dosya çalıştırmak bu sınıfı **yakalamaz** — `bun test`i tam koş, ve
sıra şüphesi varsa sahteleyen dosyayı alfabetik olarak öne alacak bir kopyayla
dene.
