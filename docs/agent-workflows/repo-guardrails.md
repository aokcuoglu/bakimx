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

## 2. Hiçbir dal sunucu tarafında korumalı değil — bu kabul edilmiş bir risk

Repo private + free plan: branch protection ve rulesets API'leri **403** dönüyor
("Upgrade to GitHub Pro or make this repository public")
([`quality.yml`](../../.github/workflows/quality.yml):3-9). Sonuç ne `dev` ne de
`main` için bir kapı var: **hiçbir şey dalın güncel olmasını zorunlu kılmıyor**,
kırmızı CI'lı bir PR merge edilebiliyor ve **her iki dala da PR'sız doğrudan push
yapılabiliyor**.

**Bu bilgi eksikliği değil, karardır.** BAK-57'de üç seçenek ölçüldü (Pro $4/ay →
klasik branch protection; Team $16/ay + org transferi; repoyu public yapmak) ve
2026-08-15'te Pro **bütçe olmadığı için alınmadı**. Yani `main`'in korumasızlığı
bilinçli olarak kabul edilmiş bir risktir; yerine ücretsiz bir **görünürlük**
katmanı kondu (aşağısı). Karar değişirse açılacak kutular — PR zorunlu (required
approvals **0**; 20 günde 19 merge yapan tek kişi kendini bloke etmesin), status
check `quality` zorunlu, dalın güncel olması zorunlu, admin dahil bypass yok.

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

### 2.3 PR'sız `main` push'u alarm verir (ama durdurmaz)

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

### 2.4 PR'sız commit prod'a çıkamaz

Alarm haber verir, kapı durdurur:
[`deploy-prod-aws.yml`](../../.github/workflows/deploy-prod-aws.yml) içindeki
`pr-origin` job'ı, `deploy`'un `needs`'inde. `main`'e gelen commit bir merged PR'a
bağlı değilse prod deploy **başlamadan düşer** (alpkaan onayı, 2026-08-15).

Bu da dalı korumaz — commit `main`'de kalır, yalnız ship edilmez. Ve bilinçli bir
kaçış yolu var: `if` job seviyesinde değil **adım** seviyesindedir, yani
`workflow_dispatch` ile elle çalıştırıldığında job sıfır adımla yeşil geçer.
Gerçek bir hotfix'te prod'a çıkmanın hiçbir yolunun kalmaması kapının kendisinden
büyük risk; elle çalıştırma zaten iz bırakır (kim başlattı Actions'ta görünür) ve
`main-push-guard` yine kırmızıdır. `if`'i job seviyesine taşıma: o zaman dispatch
sırasında job *skipped* olur ve ona bağlı `deploy` da atlanır.

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

`rbac-coverage` ve `photo-visibility` bilinçli istisnalar için gerekçeli bir
allowlist tutar. İstisna gerekiyorsa oraya **gerekçesiyle** ekle; testi gevşetme
ya da taramayı daraltma.
