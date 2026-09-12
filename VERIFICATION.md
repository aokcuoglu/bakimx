# Attio referanslı yerel deneme — #635

12 Eylül 2026 revizyonu. Issue: https://github.com/aokcuoglu/bakimx/issues/635. Branch: `issue/635-light-landing`. Worktree: `/private/tmp/bakimx-issue-635`. Önizleme: http://localhost:3100. İlk deneme `bf397705` commit'inde saklıdır.

## Değişiklik

- `HeroSection.tsx`: merkezde yeni mesaj, kısa açıklama, iki CTA. Hedef ve analitik konum/event sözleşmeleri korunur.
- `ProductStage.tsx`: demo servis özeti ve iş emri kompozisyonu, mevcut parça kataloğu görseli. Motion ile üç pencereye kaydırma hareketi.
- `landing-editorial.module.css`: beyaz zemin, büyük tipografi, katmanlar, tema tokenları, mobil ve reduced-motion kuralları; yalnız bu iki bölüme uygulanır.
- `LandingContent.tsx`: önceki sekmeli ürün turu yerine ProductStage export eder; diğer bölümler değiştirilmez.
- Landing/page testleri yeni mesaj ve kompozisyona uyarlanmıştır. `DESIGN.md` yeni tasarım kararlarını kaydeder.

Dashboard ve iş emri görünümleri HTML/CSS ile hazırlanmış örnek kompozisyonlardır; gerçek servis verisi ya da birebir uygulama ekran görüntüsü değildir. Katalog görseli mevcut ürün ekranıdır. Bu ayrım sayfada demo verisi notuyla belirtilir. Yeni bağımlılık, API, DB, fiyat politikası veya global tema değişikliği yoktur.

## Kontroller

- `bun test`: **2207 başarılı, 2 isteğe bağlı PostgreSQL testi atlandı, 0 hata**.
- `bun run lint`: **başarılı**.
- `PLAYWRIGHT_PORT=3100 bun run test:e2e e2e/landing-product-stage.e2e.ts --trace off`: **başarılı**. Tek senaryoda 320/390/768/1440px taşma, üç pencere, CTA hedefleri, tek H1, axe WCAG A/AA, reduced-motion, gerçek kaydırma transform değişimi ve JavaScript kapalı H1/CTA/dashboard kontrol edilir. Tüm uygulamanın E2E paketi yeşil olarak iddia edilmez.
- Typecheck build öncesinde başarılıydı. Build'in ürettiği route tipleri sonrasında mevcut `askWithTimeout` export hatasını bildirir.
- `bun run build --webpack`: derleme aşaması geçer; Next route doğrulaması `src/app/api/assistant/ask/route.ts:18` içindeki geçersiz `askWithTimeout` export'unda durur. Aynı export başlangıç `origin/dev` commit'inde vardır ve değiştirilmemiştir. Bu sebeple tam üretim gate'i yeşil değildir.
- Masaüstü ve mobil görüntüler görsel olarak incelendi. Hareket azaltmada CSS transform'u kaldırır; paylaşılan `usePrefersReducedMotion` hook'u SSR/hidrasyon uyumunu korur. Ana mesaj Motion kullanmaz.

## Yerel kullanım ve teslim

Başlatma: `bun run dev --webpack -p 3100`. node_modules ana checkout'a bağlı olduğu için bu worktree'de Webpack kullanılır. `.env.local` içeriği değiştirilmedi. Analitik test sunucusu `NEXT_PUBLIC_ANALYTICS_ENABLED=true`, `NEXT_PUBLIC_GA_MEASUREMENT_ID=''` ile harici GA teslimatı olmadan açıldı.

[Güncel galeri](artifacts/issue-635/attio/index.html). Yenileme: `node scripts/issue-635-attio-qa.mjs`. Görüntülerde yalnız Next geliştirme rozeti gizlenir. [İlk deneme](artifacts/issue-635/index.html) karşılaştırma için korunur.

Ana checkout değişiklikleri korunmuştur. PR, push, merge ve yayın yapılmamıştır. Issue tasarım değerlendirmesi için açıktır. Sonraki sorumlu ürün/tasarım sahibidir. Üretime hazırlık için mevcut route export hatası ayrıca çözülmelidir. Kayıt dönüşümü ölçülmemiştir.
