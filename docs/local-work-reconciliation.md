# Yerel çalışma uzlaştırması — 15 Eylül 2026

## Kapsam ve yöntem

Kullanıcı, mevcut branch dahil tüm yerel çalışmaları commit ve PR üzerinden `dev`e teslim etmeyi istedi. Başlangıç karşılaştırması `origin/dev` = `2e8e3c15`; ana checkout `issue/648-blog-hero-typography` = `346a7fd6`. Başlangıçta 170 yerel branch, bir worktree ve yedi stash vardı.

- Mevcut çalışma dizini: 8 değiştirilmiş, 5 yeni dosya.
- 141 eski branch’in commit geçmişi dev’in atası değildi. Bunların 44’ündeki non-merge patch’ler eşdeğerdi; kalan 97 branch’te toplam 157 farklı non-merge commit birebir patch eşleşmiyordu. Bu sayılar eksik iş sayısı değildir.
- `git cherry` ile birebir patch eşitliği kontrol edildi; squash ve sonraki düzenlemeler için dosya/blob geçmişi, eklenen satırlar ve birleşmiş PR kayıtları karşılaştırıldı.
- Eski bir SHA veya farklı blob, tek başına eksik ürün davranışı sayılmadı. GitHub’da aynı değişikliğin squash commit ile yer alması ve daha yeni kararlar dikkate alındı.
- Ana checkout’taki 13 çalışma dosyasının PR #651 merge commit’iyle byte-byte aynı olduğu doğrulandı; dosyalar kaybedilmeden yerel `dev`e geçildi. Eski branch ve stash referansları korunur. Bu rapor her eski SHA’nın dev geçmişine eklendiği anlamına gelmez.

## Bu turda teslim edilen çalışmalar

| Kaynak | İş | Teslimat |
| --- | --- | --- |
| Ana checkout | Kayıt sonrası doğrulama ekranı | #645; [PR #651](https://github.com/aokcuoglu/bakimx/pull/651), `c54072b6` |
| Ana checkout | Ortak Button/CTA ölçüleri, header, tasarım sözleşmesi | #647; PR #651 |
| Ana checkout | Blog Switzer fontları ve hero ölçüleri | #648; PR #651 |
| `stash@{1}` | İzinli click-ID/demo dönüşümü ve demo özet sayfası | #649, ayrı PR |
| `stash@{2}` | Katalog listesinin kendi alanında kaydırılması | #650 |
| `stash@{3}^3` | Tarih seçicide temizle/tamam, ay/yıl seçimi, tamamlanan aralıkta kapanma | #650 |

## Kullanıcının bu turdaki kararları

1. Eski taslaklar da yeniden değerlendirilecek; henüz teslim edilmemiş çelişkiler ayrı sorulacak.
2. Reklam/click-ID taslağı güncel kodla uzlaştırılıp ayrı PR’a alınacak.
3. İletişim verisi paylaşımı kararını kullanıcı asistana bıraktı. Seçilen kapsam: açık reklam izniyle click-ID ve iletişim bilgisi içermeyen demo dönüşümü. Google Ads demo dönüşümü kullanılacak; Meta Pixel/CAPI yüklenmeyecek, `fbclid` yalnız içeride saklanacak. Telefon/e-posta eşleştirmesi ve CRM aşama aktarımı yok.
4. Tarih seçicinin ek kolaylıkları onaylandı; mevcut tek gün ve açık uçlu aralık davranışı korunacak.

## Stash envanteri

| Kaynak ve SHA | Sonuç / kanıt |
| --- | --- |
| `stash@{0}` / `a2734e57909a` | Landing/footer/FAQ/görseller: değişen ve untracked blob’ların tamamı dev geçmişinde mevcut; #639/#641 ve sonraki public teslimatları. Yeniden uygulanmaz. |
| `stash@{1}` / `9e1d2ffd133e` | Gerçekten teslim edilmemiş pazarlama taslağı. #649 ile sınırlı veri/izin kararı altında yeniden uygulanır. Eski ticari garanti metni güncel onaylı mesajlarla uzlaştırılır. |
| `stash@{2}` / `be7791ecf3a6` | Katalog kaydırma sınıfı dev geçmişinde bulunmuyor; #650 ile kurtarılır. Mevcut 50 satırlı sayfalama korunur. |
| `stash@{3}` / `f2e08ac15953` | Denetim metadata yardımcısı ve testi dev ile birebir aynı (#563, `95272867`); activity-tables de aynı. Feature override etiketleri #559/`61ef5130` ile bilinçli kaldırılmıştır. Ayrı untracked tarih seçici kolaylıkları #650 kapsamında alınır. |
| `stash@{4}` / `d090e3551c75` | Geniş eski geliştirme snapshot’ı. Satış, yönetim, checkout alanları, kayıt istemcisi, KDV/fatura doğrulaması ve toast konumu `0d274795` ile teslim edilmiş; sonraki #577/#611/#639 kayıt akışını değiştirmiştir. Sonraki ücretsiz kayıt/paket kararları geri alınmaz. Detaylar aşağıda. |
| `stash@{5}` / `12391e634ca8` | Araç Decimal dönüşümü ve miktar testi blob’ları dev geçmişinde mevcut; #519/`e8904218` ve devamı. Güncel soft-delete hasar filtresi korunur. |
| `stash@{6}` / `5510b0210d8d` | Fotoğraf carousel/proxy/geçmiş ve test blob’ları dev geçmişinde mevcut; #517/#519. Eski dosyalar yeniden uygulanmaz. |

## Eski farklılıkların uzlaştırılması

| Eski çalışma | Güncel kanıt / neden geri uygulanmadığı |
| --- | --- |
| Sayfa başlıkları `d15d54a3` | #644 (`346a7fd6`) başlıkları blog/contact/public düzenlemeleriyle birlikte içerir. Farklar eklenen public sayfalar/font kapsamıdır. |
| Fotoğraf kotası `4fa89025` | #613 (`87399245`); güncel kota sorgusu transaction istemcisi ve `VISIBLE_PHOTO` filtresi kullanır. Eski doğrudan count sorgusu geri alınmaz. |
| ProductStage `67bdab78` ve takip commit’leri | #639/#641; eski native `title` kullanımları güncel Tooltip, footer çerez bağlantısı güncel yerleşim ile karşılanır. |
| Shell/Radix geçişi `456f0489`, `9f08f9de`, `ca5fbf04` | #445/#449 ve sonraki Radix işleri; Escape kapatma güncel sidebar’da mevcut. Eski Base UI `render`/`nativeButton` çağrıları geri alınmaz. |
| Web Push `64be7966` | #427; eski `mock.module` sızıntısı sonraki test izolasyonu düzeltmesiyle çözülmüş. Gönderim davranışı güncel çözümde korunur. |
| SSO bootstrap `ecfe5f3f` | #410 ve sonraki admin/auth düzenlemeleri; eski bootstrap/mocking ara sürümü güncel güvenlik sınırına uygulanmaz. |
| KDV `fa20f3b2`, `fb39326f` | #366/#374/#377 ve devamı; satır vergisi ile gösterim kipinin eski geçici eşleştirmesi güncel modelin yerine geçirilmez. |
| Eski 4/6 adımlı kayıt | #370 sonrası #577/#611/#639; güncel ücretsiz kayıt ve üyelik sonrası kurulum akışı korunur. |
| Sonner/yarı saydam sidebar | `0d274795`, #534/#536 ve kontrast kapıları; daha yeni opak/kontrastlı yüzeyler korunur. |
| Agent notları, ekran görüntüleri, tunnel log’ları, geçici issue açıklamaları | Uygulama davranışı değiller; eski yerel referanslarda korunur, kaynak kod/çalışma ortamı log’u olarak dev’e taşınmaz. |
| `getirbakim` gitlink snapshot’ı | Harici checkout kaydı; BakımX’e bağımsız depo/DB bağlamak için kullanılmaz. GetirBakım partner sınırı korunur. |

## Tüm başlangıç branch’leri

Tablo, başlangıç branch başını ve geçmiş eşleşmesini kaydeder. “PR” geçmişte teslim edildiğini gösterir; güncel sürüm yukarıdaki uzlaştırma kararlarıyla değerlendirilmiştir.

| Branch | Başlangıç SHA | Geçmiş eşleşmesi |
| --- | --- | --- |
| `agent/ada/01a01ec1` | `eb106291` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/ada/2dfa35bc` | `d0e1e35c` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/ada/8965236c` | `0ac315c5` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/ada/e9cfe6ae` | `6a31e35c` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/ada/ed40f0db` | `d7051b73` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/ada/f0e653c2` | `1cfc5762` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/bak-71-wizard-expand` | `25a44e81` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/bedrock-claude-opus-4-6/04d8a167` | `ec67433e` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/bedrock-claude-opus-4-6/094cdb50` | `2007ec16` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/bedrock-claude-opus-4-6/0a3ec602` | `bd8c409c` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/bedrock-claude-opus-4-6/0cfe8863` | `ec67433e` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/bedrock-claude-opus-4-6/3c5cdff8` | `0b08748a` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/bedrock-claude-opus-4-6/5a52ee83` | `54535d03` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/bedrock-claude-opus-4-6/744f784c` | `030effb6` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/bedrock-claude-opus-4-6/76f28cd9` | `85394fcd` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/bedrock-claude-opus-4-6/7dfbd14a` | `83b4605a` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/bedrock-claude-opus-4-6/98538f75` | `ec67433e` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/bedrock-claude-opus-4-6/c960f4fb` | `d9606fc6` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/bedrock-claude-opus-4-6/df1d2a18` | `ecfe5f3f` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/bedrock-claude-opus-4-6/f7aa948c` | `fcb57949` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/bedrock-claude-opus-4-6/fe82946f` | `538f5ede` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/deniz-derin/01a01eb2` | `e64b9b0a` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/deniz-derin/01a01ee0` | `3e3fb03f` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/deniz-derin/08db15f6` | `029b0b81` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/deniz-derin/4d2cde1c` | `92c49059` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/deniz-derin/4f620de0` | `5c0f865e` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/deniz-derin/725c2382` | `d268627e` | dev geçmişinde |
| `agent/deniz-derin/76acbef5` | `8bcf69c2` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/deniz-derin/9a78c62f` | `d268627e` | dev geçmişinde |
| `agent/deniz-derin/a40a3c47` | `d268627e` | dev geçmişinde |
| `agent/deniz-derin/b60f7d65` | `daebce86` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/deniz-derin/cd2cc44d` | `d268627e` | dev geçmişinde |
| `agent/deniz-derin/d1cf1bf6` | `0302663c` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/deniz-derin/d380a72d` | `d268627e` | dev geçmişinde |
| `agent/deniz-h-zl/01a01eb6` | `a64acbc1` | [PR #459](https://github.com/aokcuoglu/bakimx/pull/459) |
| `agent/deniz-h-zl/01a01ebb` | `d268627e` | dev geçmişinde |
| `agent/deniz-h-zl/078dbb0d` | `8f91d07a` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/deniz-h-zl/2b51551c` | `d268627e` | dev geçmişinde |
| `agent/deniz-h-zl/5c1dbb97` | `ab2acb23` | dev geçmişinde |
| `agent/deniz-h-zl/7ebd9283` | `e1004aba` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/deniz-h-zl/7fdb8986` | `d7f33e43` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/deniz-h-zl/afe297ca` | `662bc23f` | [PR #439](https://github.com/aokcuoglu/bakimx/pull/439) |
| `agent/deniz-h-zl/d97567ee` | `a8d6024b` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/deniz-h-zl/df209a20` | `2d4aead9` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/deniz-h-zl/e36e5525` | `1f43ab8e` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/deniz/01a01ea3` | `d268627e` | dev geçmişinde |
| `agent/deniz/01a01ebd` | `d268627e` | dev geçmişinde |
| `agent/deniz/01a01ec1` | `d268627e` | dev geçmişinde |
| `agent/deniz/0e45d7ff` | `1c0d1789` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/deniz/336e0f23` | `80cb17bf` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/deniz/5652f757` | `62a088c1` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/deniz/78c2bb7f` | `9cc66dce` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/deniz/8216fd61` | `738e2d53` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/01a01eb1` | `4e86970c` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/01a01eba` | `d268627e` | dev geçmişinde |
| `agent/mika/01a01ec1` | `d268627e` | dev geçmişinde |
| `agent/mika/01a01ed3-1787223603` | `d268627e` | dev geçmişinde |
| `agent/mika/17260757` | `de59467b` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/19bd952c` | `0c49c98e` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/1b47fce9` | `46e956fc` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/53ae7a25` | `fd18aa9a` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/564b9a75` | `82fbe097` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/56eee265` | `08d138e3` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/5e739961` | `f953d888` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/6386d2d3` | `9742543c` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/63c66e0a` | `90d09e56` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/6836508d` | `9f70cacf` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/6b6bc143` | `6b1fe121` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/78e93d62` | `ab53ee22` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/892d82c7` | `184a14b7` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/8c2a5f5f` | `4db7e147` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/9d7779fb` | `555d1e10` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/b1c9d316` | `a83f829a` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/c845b7e4` | `435b4095` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/c914eaf8` | `2f6498e6` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/dacd9deb` | `83b4605a` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/dc4fed44` | `5f370289` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/f3b4b5dd` | `7b6baf23` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/f52f0caa` | `6126d11e` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `agent/mika/f7e6dd6f` | `07e8338c` | Eski agent snapshot’ı; teslim edilmiş feature geçmişi / yerel notlar |
| `atlas/bak-211-expand-units` | `86a20441` | [PR #496](https://github.com/aokcuoglu/bakimx/pull/496) |
| `backup/dev-pre-sync-20260906-4fa89025` | `4fa89025` | [PR #613](https://github.com/aokcuoglu/bakimx/pull/613) / yukarıdaki uzlaştırma |
| `chore/local-dev-changes` | `af078c3e` | dev geçmişinde |
| `design/footer-reference-proportions` | `8e686029` | dev geçmişinde |
| `dev` | `346a7fd6` | dev geçmişinde |
| `dev-backup-20260818` | `531d7e56` | [PR #384](https://github.com/aokcuoglu/bakimx/pull/384) / yukarıdaki uzlaştırma |
| `feat/landing-interactive-product-stage` | `d2e2c682` | [PR #639](https://github.com/aokcuoglu/bakimx/pull/639) |
| `feature/work-order-line-display-name` | `6d5d2cb4` | dev geçmişinde |
| `fix/bak-105-external-labor-quantity` | `37f27d47` | [PR #413](https://github.com/aokcuoglu/bakimx/pull/413) |
| `fix/mobile-header-logo-responsive` | `1a73e517` | [PR #536](https://github.com/aokcuoglu/bakimx/pull/536) |
| `fix/vehicle-photo-history` | `bf91e0a5` | [PR #517](https://github.com/aokcuoglu/bakimx/pull/517) |
| `issue/107-unified-personnel` | `b8fc70b6` | [PR #415](https://github.com/aokcuoglu/bakimx/pull/415) |
| `issue/108-technician-order-wizard` | `00ea0442` | [PR #417](https://github.com/aokcuoglu/bakimx/pull/417) |
| `issue/119-status-comm-twitter` | `da94548a` | [PR #421](https://github.com/aokcuoglu/bakimx/pull/421) |
| `issue/132-technician-notifications-network-error` | `6de19a85` | [PR #426](https://github.com/aokcuoglu/bakimx/pull/426) |
| `issue/134-bg-white-loader2` | `b4148c48` | [PR #429](https://github.com/aokcuoglu/bakimx/pull/429) |
| `issue/142-mobile-navbar-logo` | `7b35d0c1` | dev geçmişinde |
| `issue/145-mobile-component-sizing` | `d268627e` | dev geçmişinde |
| `issue/532-market-research-limits-byok` | `37c770f4` | [PR #533](https://github.com/aokcuoglu/bakimx/pull/533) |
| `issue/565-announcement-script` | `0e510416` | [PR #566](https://github.com/aokcuoglu/bakimx/pull/566) |
| `issue/602-landing-redesign` | `4b60b563` | [PR #605](https://github.com/aokcuoglu/bakimx/pull/605) |
| `issue/619-prod-schema-drift` | `9b113b2e` | [PR #620](https://github.com/aokcuoglu/bakimx/pull/620) |
| `issue/635-blog-article-layout` | `d15d54a3` | [PR #644](https://github.com/aokcuoglu/bakimx/pull/644) / yukarıdaki uzlaştırma |
| `issue/635-remove-home-ruhsat-demo` | `9a920d9f` | dev geçmişinde |
| `issue/642-page-titles` | `d15d54a3` | [PR #644](https://github.com/aokcuoglu/bakimx/pull/644) / yukarıdaki uzlaştırma |
| `issue/645-register-verification-design` | `346a7fd6` | dev geçmişinde |
| `issue/647-clutch-buttons` | `346a7fd6` | dev geçmişinde |
| `issue/648-blog-hero-typography` | `346a7fd6` | dev geçmişinde |
| `issue/66-remove-evidence-summary` | `7957fd50` | [PR #368](https://github.com/aokcuoglu/bakimx/pull/368) |
| `issue/71-register-wizard` | `de59467b` | [PR #370](https://github.com/aokcuoglu/bakimx/pull/370) |
| `issue/82-landing-faz-4-qa` | `9874a971` | [PR #389](https://github.com/aokcuoglu/bakimx/pull/389) |
| `issue/94-break-glass-access` | `e4e462f9` | [PR #416](https://github.com/aokcuoglu/bakimx/pull/416) |
| `issue/BAK-102-handover-always-visible` | `c7c40561` | [PR #404](https://github.com/aokcuoglu/bakimx/pull/404) |
| `issue/BAK-103-invoice-filter` | `bd5ad487` | [PR #407](https://github.com/aokcuoglu/bakimx/pull/407) |
| `issue/BAK-104-parts-labor-grid` | `67dfc3c1` | [PR #409](https://github.com/aokcuoglu/bakimx/pull/409) |
| `issue/BAK-111-teknisyen-dis-alim-foto` | `5b57495f` | [PR #400](https://github.com/aokcuoglu/bakimx/pull/400) |
| `issue/BAK-114-sso-env-bootstrap` | `518c13a3` | [PR #410](https://github.com/aokcuoglu/bakimx/pull/410) |
| `issue/BAK-117-admin-badge-role-status-cleanup` | `c88321b8` | [PR #418](https://github.com/aokcuoglu/bakimx/pull/418) |
| `issue/BAK-128-internal-status-page` | `50c8b4cd` | [PR #430](https://github.com/aokcuoglu/bakimx/pull/430) |
| `issue/BAK-131-team-invite-form-rhf` | `e02f65dc` | [PR #425](https://github.com/aokcuoglu/bakimx/pull/425) |
| `issue/BAK-133-mobile-wizard-aria` | `ff552f19` | [PR #424](https://github.com/aokcuoglu/bakimx/pull/424) |
| `issue/BAK-137-technician-tabs` | `ad01902c` | [PR #436](https://github.com/aokcuoglu/bakimx/pull/436) |
| `issue/BAK-140-part-added-notification` | `1088a202` | [PR #434](https://github.com/aokcuoglu/bakimx/pull/434) |
| `issue/BAK-148-hold-quick-actions` | `bb42c8ee` | [PR #440](https://github.com/aokcuoglu/bakimx/pull/440) |
| `issue/BAK-150-ui-scale-radius` | `804e014b` | [PR #443](https://github.com/aokcuoglu/bakimx/pull/443) |
| `issue/BAK-151-shadcn-sidebar-shell` | `a625e008` | dev geçmişinde |
| `issue/BAK-151-shell-contract-fix` | `ca5fbf04` | [PR #445](https://github.com/aokcuoglu/bakimx/pull/445) / yukarıdaki uzlaştırma |
| `issue/BAK-152-radix-nova-core` | `ef48fff7` | [PR #446](https://github.com/aokcuoglu/bakimx/pull/446) |
| `issue/BAK-153-radix-overlay` | `a9c2977b` | [PR #449](https://github.com/aokcuoglu/bakimx/pull/449) |
| `issue/BAK-155-radix-combobox` | `89987890` | [PR #451](https://github.com/aokcuoglu/bakimx/pull/451) |
| `issue/BAK-156-ui-closeout` | `731fe1ef` | [PR #452](https://github.com/aokcuoglu/bakimx/pull/452) |
| `issue/BAK-157-technician-all-orders` | `c784f614` | [PR #447](https://github.com/aokcuoglu/bakimx/pull/447) |
| `issue/BAK-159-dashboard-layout` | `77dd8f63` | [PR #454](https://github.com/aokcuoglu/bakimx/pull/454) |
| `issue/BAK-163-technical-seo` | `61883104` | [PR #455](https://github.com/aokcuoglu/bakimx/pull/455) |
| `issue/BAK-168-oto-servis-programi` | `f11ba236` | [PR #456](https://github.com/aokcuoglu/bakimx/pull/456) |
| `issue/BAK-169-dijital-arac-kabul` | `2e1f680a` | [PR #460](https://github.com/aokcuoglu/bakimx/pull/460) |
| `issue/BAK-181-design-system-debt` | `9020b192` | dev geçmişinde |
| `issue/BAK-73-live-chat-admin-notify` | `5e411d50` | [PR #388](https://github.com/aokcuoglu/bakimx/pull/388) |
| `issue/BAK-75-kdv-followup` | `8f409c7f` | [PR #377](https://github.com/aokcuoglu/bakimx/pull/377) |
| `issue/BAK-75-kdv-hesaplama` | `ef962aa4` | [PR #374](https://github.com/aokcuoglu/bakimx/pull/374) |
| `issue/BAK-76-ruhsat-vin-okuma` | `04dfdbcc` | [PR #373](https://github.com/aokcuoglu/bakimx/pull/373) |
| `issue/BAK-79-landing-hero-faz1` | `9739a5d6` | [PR #376](https://github.com/aokcuoglu/bakimx/pull/376) |
| `issue/BAK-80-landing-objection-cards` | `0a9efae5` | [PR #380](https://github.com/aokcuoglu/bakimx/pull/380) |
| `issue/BAK-81-landing-ask-bar` | `0823a3dc` | [PR #382](https://github.com/aokcuoglu/bakimx/pull/382) |
| `issue/BAK-83-purchase-item-delete` | `0a2a4414` | [PR #378](https://github.com/aokcuoglu/bakimx/pull/378) |
| `issue/BAK-84-dis-alim-parca-eslestirme` | `9c8755bf` | [PR #381](https://github.com/aokcuoglu/bakimx/pull/381) |
| `issue/BAK-84-external-part-catalog-match` | `c53f148a` | [PR #377](https://github.com/aokcuoglu/bakimx/pull/377) / yukarıdaki uzlaştırma |
| `issue/BAK-88-platform-admin-model` | `d116b787` | [PR #385](https://github.com/aokcuoglu/bakimx/pull/385) |
| `issue/BAK-90-dev-deploy-opt-in` | `5c18ca71` | [PR #386](https://github.com/aokcuoglu/bakimx/pull/386) |
| `issue/BAK-91-purchase-margin-warning` | `4059fff0` | [PR #390](https://github.com/aokcuoglu/bakimx/pull/390) |
| `issue/BAK-92-landing-assistant-ai` | `baaa5283` | [PR #395](https://github.com/aokcuoglu/bakimx/pull/395) |
| `issue/BAK-93-platform-admin-db` | `c68102b9` | [PR #393](https://github.com/aokcuoglu/bakimx/pull/393) |
| `issue/BAK-98-support-request-workshop` | `896ee002` | [PR #403](https://github.com/aokcuoglu/bakimx/pull/403) |
| `issue/BAK-99-visitor-reply-email` | `865ee5c7` | [PR #408](https://github.com/aokcuoglu/bakimx/pull/408) |
| `issue/bak-116-shared-rate-limit` | `1f1aeab5` | [PR #420](https://github.com/aokcuoglu/bakimx/pull/420) |
| `issue/bak-129-web-push` | `888d3e02` | [PR #427](https://github.com/aokcuoglu/bakimx/pull/427) |
| `issue/bak-138-labor-session-note-edit` | `ce2e52e9` | [PR #437](https://github.com/aokcuoglu/bakimx/pull/437) |
| `issue/bak-141-teknisyen-parca-iscilik` | `0bb019ac` | [PR #435](https://github.com/aokcuoglu/bakimx/pull/435) |
| `issue/bak-72-notification-text-contrast` | `fd90fe84` | [PR #369](https://github.com/aokcuoglu/bakimx/pull/369) |
| `issue/bak-73-live-chat` | `f02338cf` | [PR #371](https://github.com/aokcuoglu/bakimx/pull/371) |
| `issue/bak-74-assistant-widget-polish` | `e6974b2b` | [PR #372](https://github.com/aokcuoglu/bakimx/pull/372) |
| `issue/bak-85-parts-request-decisions` | `f589c4fd` | [PR #379](https://github.com/aokcuoglu/bakimx/pull/379) |
| `issue/bak-95-admin-workshop-list` | `8f03d4e3` | [PR #396](https://github.com/aokcuoglu/bakimx/pull/396) |
| `issue/getirbakim-select-tecdoc-ux` | `32877f5f` | [PR #516](https://github.com/aokcuoglu/bakimx/pull/516) |
| `main` | `42380e25` | dev geçmişinde |
| `release/619-prod-schema-drift` | `aeab4282` | [PR #622](https://github.com/aokcuoglu/bakimx/pull/622) |
| `release/v0.14.0` | `382f39fa` | [PR #383](https://github.com/aokcuoglu/bakimx/pull/383) |
| `ui/technician-shadcn-composition` | `55fd6b58` | [PR #535](https://github.com/aokcuoglu/bakimx/pull/535) |
| `ui/version-reload-overlay` | `633bb889` | dev geçmişinde |
| `ui/version-update-alert` | `0893dc7b` | dev geçmişinde |

## Doğrulama ve sınırlar

Her aktif teslimatın test, lint, typecheck, build ve tarayıcı sonuçları kendi PR’ında kaydedilir. Bu rapor üretim yayını veya veri migration’ının üretimde çalıştırıldığı iddiası değildir. Eski branch/stash’lere toplu merge, force-push veya silme uygulanmaz.
