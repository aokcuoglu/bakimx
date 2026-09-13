# Yerel değişikliklerin dev teslimatı — #643 / #642

13 Eylül 2026 kullanıcı talebi: yerelde bekleyen çalışmaları commit, PR ve merge ile GitHub dev dalına aktar.

## Kapsam

- #642: mevcut d15d54a3 commit'indeki public/auth/uygulama/admin sekme başlıkları, metadata ve regresyon testleri.
- #643: MDX blog listesi ve ortak yazı şablonu, dört yazı, iletişim formu, header/footer, Motion ürün sahnesi, Inter/Schibsted tipografi, nötr metin tokenları, SEO/sitemap/llms ve mevcut QA görselleri.
- Teslimat kontrolünde düzeltildi: llms bağlantı sayısı; demo modalı testinin ürün pencereleriyle karışması; animasyon kapsayıcısı sonrası sürükleme sınırı ve pencere katman sırası; ruhsat sekmesi kontrastı; iletişim gizlilik bağlantısının alt çizgisi.
- İletişim formu testi destek API'sini tarayıcıda sahteleyerek validasyon, hata sonrası veri koruma ve başarı akışını doğrular; gerçek mesaj göndermez.

## Dal uzlaştırması

Tek kayıtlı worktree ana checkout idi. `issue/635-blog-article-layout` ve `issue/642-page-titles` aynı d15d54a3 commit'ini gösteriyordu; tek kez dahil edildi. Kirli checkout yeni `issue/643-local-delivery` dalında commit edildi.

`issue/*`, `feat/*`, `feature/*`, `fix/*`, `ui/*`, `atlas/*`, `design/*`, `chore/*` dalları origin/dev ancestry ve GitHub merged PR kayıtlarıyla karşılaştırıldı. Eski squash dalları tekrar merge edilmedi. Özel karşılaştırmalar:

- `feat/landing-interactive-product-stage`: PR #639 ile teslim edilmiş.
- `issue/BAK-151-shell-contract-fix`: commit GitHub üzerinden PR #445'e bağlı.
- `atlas/bak-211-expand-units`: ek dört commit dev'deki 22e5439a, 2c81d43a, 0dfd0cf5, 9768ca75 karşılıklarıyla teslim edilmiş; son commit patch-id birebir aynı.
- `fix/vehicle-photo-history` ve `issue/getirbakim-select-tecdoc-ux`: farkların kalan kısmı dev entegrasyon merge'leri; yeni feature yok.
- `issue/82-landing-faz-4-qa` ve `issue/BAK-91-purchase-margin-warning`: yerel uçlar GitHub'da sırasıyla merged PR #389 ve #390'a bağlı.
- `issue/BAK-84-external-part-catalog-match`: eski release geçmişi; mevcut dev'e yeniden uygulanmadı.
- `issue/BAK-111-teknisyen-dis-alim-foto`: PR #400 sonrasında kalan 5b57495f yalnız dört QA PNG'si içeriyordu; `.agent_context/bak111/` altına kayıpsız dahil edildi.

`agent/*`, backup ve eski release dalları tarihsel snapshot olarak korundu; güncel davranışı geri alabilecek arşivler yeniden uygulanmadı. Eski dallar topluca silinmedi.

## Doğrulama

- Unit: 2358 başarılı, 2 PostgreSQL entegrasyon testi ortam gereksinimi nedeniyle skipped.
- Lint, typecheck ve production build.
- Blog: 11 test; beş genişlik, Axe, hash/TOC, canonical/SEO, JS kapalı ve reduced-motion.
- Sayfa başlıkları: 21 test; public/auth, istemci gezinmesi ve oturumlu iç sayfalar.
- Ürün sahnesi: sürükleme, 320/390/768/1440px, Axe ve JS kapalı içerik.
- Public site: demo klavye yaşam döngüsü, hata/başarı, iletişim ve blog dahil public rotalarda responsive/Axe.
- İletişim formu: validasyon, başarısız gönderim sonrası veri koruma, başarılı tekrar gönderim.

Şema/migration değişikliği ve production yayını yok. Mevcut middleware → proxy deprecation uyarısı sürüyor. Eski blog QA belgesi tarihsel yerel teslim kaydıdır; dev teslimatının güncel kapsamı bu belgedir.
