# Yerel tasarım denemesi — #635

- Issue: https://github.com/aokcuoglu/bakimx/issues/635
- Branch: `issue/635-light-landing`
- Başlangıç commit'i: `8e8ee8f0` (`origin/dev`).
- Worktree: `/private/tmp/bakimx-issue-635`
- Önizleme: http://localhost:3100
- Başlatma: `bun run dev --webpack -p 3100`. Bağımlılıklar ana checkout'a symlink olduğu için Turbopack kök sınırı yerine Webpack kullanılır. `.env.local` mevcut worktree kurulum script'iyle bağlandı; içerik değiştirilmedi.

## Kapsam ve dosyalar

`HeroSection.tsx`: sabit mesaj ve CTA'lar, üç ürün sekmesi, mevcut ruhsat ve ekran görüntüleri, örnek bilgi kartı. `LandingContent.tsx`: yalnız ProductTourSection boşlukları ve mobil görsel sırası. `DESIGN.md`: tipografi, renk, yerleşim ve erişilebilirlik kuralları. Landing E2E ve page unit sözleşmeleri yeni davranışa uyarlandı; Lite edinim testinin hero seçicisi güncellendi. `scripts/issue-635-capture.mjs` görüntüleri yeniden üretir.

Yeni bağımlılık, API, DB veya global tema değişikliği yok. Ana checkout'taki kaydedilmemiş değişikliklere dokunulmadı. PR, push, merge ve yayın yapılmadı. Issue yerel tasarım değerlendirmesi için açık tutuldu.

## Doğrulama

- `bun test`: 2207 başarılı, 2 isteğe bağlı PostgreSQL entegrasyon testi atlandı, 0 hata.
- `bun run lint`: başarılı.
- Typecheck ilk çalıştırmada başarılıydı. Build'in ürettiği `.next/types` sonrasında mevcut route export hatasını bildiriyor.
- `bun run build --webpack`: derleme tamamlandı, Next route tip doğrulaması `src/app/api/assistant/ask/route.ts:18` içindeki `askWithTimeout` export'unda durdu. Aynı export başlangıç `origin/dev` commit'inde de var; bu dosya değiştirilmedi. Standart Turbopack build ayrıca dışarı işaret eden node_modules symlink'ini kabul etmiyor. Font indirme adımı ağ izniyle geçti.
- Tarayıcı kontrolleri: dört genişlikte tüm sekmeler, taşma, görsel yükleme, mobil görsel/madde sırası, axe WCAG A/AA, ok tuşları ve Home, otomatik geçiş olmaması, tek H1, JavaScript kapalı içerik, CTA hedefleri ve mevcut analitik payload'lar. Analitik testi `NEXT_PUBLIC_ANALYTICS_ENABLED=true` ile çalıştırılır; yerel sunucuda `NEXT_PUBLIC_GA_MEASUREMENT_ID` boş bırakılarak üçüncü taraf teslimatı devre dışı tutulur.

Toplu E2E koşusu tamamen yeşil değildir: aynı sekme ve CTA kontrolleri bazı koşularda geçerken bazılarında seçim değişmemesi, olayın yakalanmaması veya gezinme zaman aşımı görülmüştür. Dört genişlikte axe/taşma, klavye, CTA/analitik ve JS kapalı içerik kontrollerinin ayrı koşularda başarılı sonuçları vardır; bu, kararlı bir toplu geçiş yerine sayılmaz. Hidrasyon/gezinme kaynaklı olabileceği düşünülüyor; kök neden kesinleştirilmedi. Tam doğrulama tamamlanmış olarak değerlendirilmemelidir.

## Karşılaştırma ve sonrki adım

[Önce/sonra galerisi](artifacts/issue-635/index.html) 1440×900 ve 390×900 pencerelerinde alınan tam sayfa görüntülerini içerir. Aynı klasörde iki bölümün tüm sekmeleri ayrı PNG olarak bulunur. Sabit başlık/CTA ve ruhsat kartı görsel olarak incelendi; parça ekranı mobilde katalog listesini yakın gösterir.

Kayıt dönüşümü ölçülmedi. Üretim tamamlanması iddiası yok. Sonraki sorumlu: ürün/tasarım sahibi; yerel denemeyi değerlendirdikten sonra kalıcılaştırma kapsamını belirler. Yayın öncesi bağımsız route export hatası çözülmeli ve build/typecheck yeniden yeşil olmalıdır.
