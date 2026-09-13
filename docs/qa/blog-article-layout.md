# Blog detay şablonu — yerel teslim

İlgili çalışma: https://github.com/aokcuoglu/bakimx/issues/635 (kapalı public tasarım denemesinin yerel devamı). Dal: `issue/635-blog-article-layout`. Yeni issue, PR, commit, merge veya production yayını yapılmadı. Mevcut commit edilmemiş blog altyapısı temel alındı; diğer yerel çalışmalar korunuyor.

## Kapsam

- `src/components/sections/BlogArticle.tsx`: sunucuda derlenen ortak yazı şablonu; breadcrumb, ayrı metadata/yazar, canonical paylaşım, demo, yazar ve ilgili yazılar.
- `src/components/sections/blog-article.module.css`: yerel 1124px çerçeve, 50/30px başlık, 220px sticky içindekiler ve en fazla 714px metin sütunu, mobil açık liste.
- `src/components/blog/article-toc.tsx`: yalnız aktif bölüm takibi için istemci bileşeni; normal hash bağlantıları SSR ve JS kapalıyken kullanılabilir.
- `src/lib/blog/article.ts`: mevcut MDX derlemesinin remark aşamasında kararlı/benzersiz başlık kimlikleri, H2/H3 içindekiler ve minimum 1 dakika/200 kelime okuma süresi.
- `src/lib/blog/posts.ts`, `types.ts`: isteğe bağlı yazar bio alanı, kategori/yenilik sıralı en fazla üç yayımlanmış ilgili yazı.
- `src/app/blog/[slug]/page.tsx`: mevcut `PublicSite customLayout` kullanımı.
- `src/lib/blog/article.test.ts`, `e2e/blog-article.e2e.ts`: veri ve tarayıcı kabul testleri.

Kapak ve açıklama yalnız detayın görünür üst bölümünden çıkarıldı. MDX yazı metinleri, URL, canonical, BlogPosting, tarih ve sosyal önizleme verileri korunuyor. Yeni API, DB değişikliği, portre veya biyografi yok.

## Doğrulama

- Blog birim testleri: 6 başarılı / 51 assertion.
- UI sözleşmesi, tema kontrastı ve SEO testleri: 25 başarılı / 59 assertion.
- Playwright: 7 düzen/davranış testi + 4 yazı/SEO testi başarılı.
- 320, 390, 768, 1024, 1440px: taşma, başlık ölçüsü, hash hedefi, klavye, aktif bölüm ve masaüstü sticky konumu doğrulandı.
- Axe: beş genişlikte yazı `main` alanında ihlal yok. Ortak header/footer'ın tamamını kapsayan yeni bir erişilebilirlik denetimi değildir.
- Canonical paylaşım hedefleri, demo, ilgili yazılar, blog listesi, doğrudan hash, JS kapalı içerik ve reduced-motion doğrulandı.
- Tam lint, typecheck ve production build başarılı. Build mevcut middleware→proxy deprecation uyarısını veriyor.
- Görseller: `artifacts/blog-article/`; `*-overview.png` dosyaları reduced-motion ile sayfa başından alınan tam sayfa görselleridir.

Kalan bağımlılık: yok. Sonraki sahip: Pixel/ürün tasarım incelemesi. Yayın bu yerel teslimin kapsamında değildir; mevcut yerel blog altyapısının commit/PR kapsamı ayrıca uzlaştırılmalıdır.

## Ölçü uyarlaması

Güncel issue/635 blog liste ölçüleri detaya uygulandı: 1124px çerçeve; 1024px altında 12px dış boşluk ve 20px iç boşluk; masaüstünde 80px yatay iç boşluk, hero altında 64px. Gezinme yolu çerçevenin üstüne alındı. Başlık, 220px içindekiler sütunu ve 64px sütun aralığı korundu. Beş genişlikte taşma yok; 11 Playwright testi (Axe dahil), ilgili ESLint ve typecheck yeniden geçti. Görseller: `artifacts/blog-article/390-frame-update.png`, `1440-frame-update.png`.
