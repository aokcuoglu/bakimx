# Yerel doğrulama — issue #635

## Kapsam ve teslim

- Worktree: `/private/tmp/bakimx-issue-635`; branch: `issue/635-light-landing`.
- Ana sayfanın tamamı, üç ürün sayfası, karşılaştırma, iki rehber, fiyatlar, demo, durum ve dört hukuki sayfa.
- Modal mevcut `/api/demo-request` sözleşmesini kullanır. Browser testlerinde istekler mock edildi; gerçek lead oluşturulmadı.
- Uygulama/admin/auth ekranları, API, DB, bağımlılıklar ve fiyat politikası değişmedi.
- Önizleme: http://localhost:3100 (Webpack dev). Yerel tasarım onaylandı; `dev` hedefli PR hazırlığına geçildi. Production deploy kapsam dışıdır.

## Geçen kontroller

- `bun test`: **2207 passed, 2 skipped, 0 failed**; 311 dosya. Skip'ler mevcut PostgreSQL entegrasyon fixture'larıdır.
- `bun run lint`: geçti; uyarı yok.
- `e2e/public-site.e2e.ts`: son bağımsız koşu **1 passed (14.7s)**. Modal Enter ile açılış, başlangıç odağı, focus trap, Escape/odağın dönüşü, hata sonrası değerlerin korunması ve yeniden gönderim; 320/390/768/1440 genişliklerinde modal ve 13 alt sayfa taşma kontrolü; tek H1; modal ve 13 alt sayfanın WCAG A/AA axe kontrolü geçti.
- `e2e/landing-product-stage.e2e.ts`: normal kaydırmada transform değişimi, reduced-motion'da hareketsiz yerleşim, dört genişlik, hero/product axe ve JS kapalı ilk içerik geçti.
- `e2e/landing-redesign.e2e.ts`: modal CTA, mobil menü, başa dönme, mock form gönderimi, FAQ deep link/JSON-LD uyumu ve ana sayfa axe/no-JS kontrolleri başarılı koşuda geçti.
- `git diff --check`: geçti.

## Açık doğrulama kısıtları

- `bun run build --webpack`: uygulama derlemesi başarılı (**19.2s**); Next'in production route tip kontrolünde mevcut `src/app/api/assistant/ask/route.ts` içindeki `askWithTimeout` export'u yüzünden başarısız. Bu dosya branch'in `origin/dev` tabanından değişmemiştir. Son `bun run typecheck` de `.next/types` üzerinden aynı mevcut export hatasıyla başarısızdır. Typecheck ve production build başarılı sayılmıyor.
- Seri Playwright koşuları dev ortamında aralıklı hidrasyon beklemeleri / `ERR_ABORTED` gösterdi. Örneğin bir koşu 7/8, başka bir koşu 5/8 geçti. İlgili testlerin bağımsız başarılı koşuları var; toplu E2E'nin kararlı yeşil olduğu iddia edilmiyor.
- Daha sonra eklenen tüm-alt-sayfa axe kontrolü bağımsız koşuda 13 route üzerinde geçti; sonuç ayrıntıları hata durumunda kısa bir hedef/özet listesi olarak raporlanır.
- Ürün dashboard ve iş emri kompozisyonları açıklayıcı örneklerdir; canlı uygulama screenshot'u değildir.
- LCP ve kayıt dönüşümü için production ölçümü yapılmadı.

## Görseller

`artifacts/issue-635/public-site/index.html` galerisi: 11 sayfanın 1440×900 ve 390×900 viewport ile tam sayfa görüntüleri, ayrıca iki modal görüntüsü. Ana sayfa/modal JS açık; alt sayfalar server-rendered/no-JS; reduced-motion açık. Lazy görseller capture için yükletildi. No-JS sayfalarda JS-tabanlı stil enjeksiyonu kullanılmadı. Önceki iki denemenin galerilerine bağlantılar vardır.

Tekrar üretim: `node scripts/issue-635-public-qa.mjs`. Capture script'i yalnız ana sayfanın hidrasyonu için en fazla iki yeniden yükleme yapabilir; testlerde bu retry uygulanmaz. Animasyonlar galeride değil canlı önizlemede değerlendirilir; kesin değerler ve tetikleyiciler `DESIGN.md` içinde.

## Sonraki sahip

Ürün sahibi: localhost:3100 üzerinde görsel değerlendirme. Bu yerel deneme yayın veya production onayı anlamına gelmez. Yayın aşamasına geçilecekse mevcut route export build engeli ve seri E2E kararlılığı önce ele alınmalıdır.
