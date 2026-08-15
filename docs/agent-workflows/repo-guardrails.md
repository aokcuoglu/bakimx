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

## 2. PR'daki yeşil tik merge sonucunu kanıtlamaz

Repo private + free plan: branch protection ve rulesets API'leri 403 dönüyor,
yani **hiçbir şey dalın güncel olmasını zorunlu kılmıyor**
([`quality.yml`](../../.github/workflows/quality.yml):3-9). Yeşil tik yalnız PR
head'inin yeşil olduğunu söyler, `dev` ile birleşmiş halinin değil. Deploy
workflow'ları bu yüzden kapıyı ship edecekleri commit'e karşı yeniden koşar.

Bunun bedeli iki kez ödendi:

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
