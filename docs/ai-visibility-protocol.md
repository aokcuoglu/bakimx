# AI crawler ve görünürlük ölçüm protokolü

Son doğrulama: 2026-08-20. Sahip: Growth/Product. Üç ayda bir ve crawler sağlayıcısı politika değiştirdiğinde yeniden doğrulanır.

## Doğrulanmış mevcut durum

- `bakimx.com/robots.txt`, origin kurallarından önce Cloudflare Managed Content bölümünü yayımlıyor: `search=yes`, `ai-train=no`, `use=reference`.
- Yönetilen bölüm GPTBot, ClaudeBot ve Google-Extended dahil eğitim/extended botlarını `Disallow: /` ile kapatıyor.
- 2026-08-20 canlı isteklerinde GPTBot, OAI-SearchBot ve Google-Extended `200`; ChatGPT-User, ClaudeBot, Claude-SearchBot ve Claude-User `403` aldı. `200`, robots izni anlamına gelmez; robots ve edge enforcement ayrı kaydedilir.
- Uygulama origin'i genel public sayfaları `Allow: /` yapıyor ve özel uygulama yollarını engelliyor. Cloudflare yönetilen metni origin çıktısının önüne ekliyor.
- `getirbakim.com` aynı Cloudflare yönetilen robots politikasını gösteriyor; bu çalışma o ürünün crawler politikasını değiştirmez.

Kaynaklar: [OpenAI crawler ayrımı](https://developers.openai.com/api/docs/bots), [Anthropic crawler ayrımı](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler), [Google crawler belgeleri](https://developers.google.com/crawling/docs/crawlers-fetchers/overview-google-crawlers), [Cloudflare managed robots](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/), [Cloudflare bot referansı](https://developers.cloudflare.com/ai-crawl-control/reference/bots/).

## Bot bazında karar tablosu

| Sağlayıcı / ajan | Amaç | Mevcut robots sinyali | Canlı edge | Ürün kararı seçeneği |
|---|---|---|---|---|
| OpenAI GPTBot | Model eğitimi | Kapalı | 200, robots ile kapalı | Kapalı tut veya eğitime açık onay ver |
| OpenAI OAI-SearchBot | ChatGPT Search indeksleme/görünürlük | Genel allow | 200 | Görünürlük için açık tut; logla |
| OpenAI ChatGPT-User | Kullanıcı yönlendirmeli retrieval | Açık kural yok | 403 | Retrieval/citation isteniyorsa edge allow gerekir |
| Anthropic ClaudeBot | Model eğitimi | Kapalı | 403 | Kapalı tut veya eğitime açık onay ver |
| Anthropic Claude-SearchBot | Claude arama indeksi | Açık kural yok | 403 | Görünürlük isteniyorsa robots + edge allow gerekir |
| Anthropic Claude-User | Kullanıcı yönlendirmeli retrieval | Açık kural yok | 403 | Citation/retrieval isteniyorsa edge allow gerekir |
| Google-Extended | Gemini Apps / model kullanım kontrolü; Google Search'i etkilemez | Kapalı | 200, robots ile kapalı | Kapalı tut veya extended kullanıma açık onay ver |
| Googlebot | Google Search ve Search AI özelliklerinin temel crawl'ı | Genel allow | 200 | Açık tut |

Robots tercihi ile Cloudflare enforcement aynı şey değildir. Değişiklik yapılacaksa iki katman birlikte doğrulanır; sadece user-agent taklidi güvenilir bot doğrulaması değildir.

## En küçük ürün/hukuk kararı

Eğitim botları için mevcut `ai-train=no` ve disallow korunabilir. Görünürlük hedefi için gereken tek karar: **kullanıcı yönlendirmeli retrieval ve AI search botlarına public marketing URL'lerinde edge erişimi verilsin mi?** Evet ise yalnız `OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot` ve `Claude-User` için public URL allow-list uygulanır; özel/app/API yolları değişmez. Eğitim botları bu karardan bağımsız kapalı kalır.

## Sabit aylık prompt seti

Promptları aynen, yeni oturumda, oturum açmadan ve Türkiye konumunda çalıştır:

1. Türkiye'de küçük bir oto servis için servis yönetim programı önerir misin?
2. Oto servis programı seçerken hangi özelliklere bakmalıyım?
3. Oto servis için araç kabul programı nedir?
4. Dijital araç kabul süreci nasıl işler?
5. Araç kabulünde fotoğraf ve hasar kaydı nasıl tutulur?
6. Oto serviste iş emri nasıl hazırlanır?
7. Oto servis iş emri programında hangi bilgiler olmalı?
8. İş emri, parça ve işçilik takibi için hangi yazılımlar var?
9. Oto servis yönetiminde defter, Excel ve yazılımı karşılaştır.
10. Küçük oto servis için Excel mi servis programı mı daha uygun?
11. Serviste unutulan işler ve kayıp notlar nasıl azaltılır?
12. Müşteriye verilen teklif ve onay süreci nasıl takip edilir?
13. Oto serviste kasa, tahsilat ve müşteri alacağı nasıl izlenir?
14. Ruhsattan araç bilgisi alarak kabul kaydı nasıl açılır?
15. Türkiye'de 7 gün denenebilen oto servis programları hangileri?

## Kayıt şeması

Her prompt/platform çifti için bir satır:

| Alan | Kural |
|---|---|
| `run_month`, `observed_at` | `YYYY-MM`, ISO-8601 + saat dilimi |
| `prompt_id`, `prompt_text` | Sabit kimlik ve değişmemiş metin |
| `platform`, `model_or_mode` | Ürün adı ve görünen model/search modu |
| `session_state`, `country`, `language` | signed-out/new, TR, tr-TR; sapmayı yaz |
| `answer_captured` | Evet/hayır; mümkünse ekran görüntüsü bağı |
| `cited_url` | Tıklanabilir kaynak URL; yoksa boş |
| `citation` | BakimX URL'si kaynak/citation alanında mı: boolean |
| `mention` | “BakimX” cevap metninde geçiyor mu: boolean |
| `recommendation` | BakimX açıkça seçenek/öneri olarak sunuluyor mu: boolean |
| `sentiment` | positive / neutral / negative / mixed; kısa gerekçe |
| `rank_or_order` | Görünen öneri sırası; uygulanmıyorsa boş |
| `notes` | Hata, geo sapması, kişiselleştirme veya belirsizlik |

`citation`, `mention` ve `recommendation` birbirinden bağımsız kaydedilir. Citation öneri değildir; yalnız marka geçmesi de öneri değildir. Aylık oranların paydası başarılı cevap alınan koşul-sabit koşumlardır; hata/blok satırları ayrıca raporlanır ve başarı paydasına katılmaz.

## Search Console sınırı

Standart Search Performance raporu tek başına platformlar arası AI citation/mention/recommendation raporu değildir. Google, 2026'da sınırlı kullanıcı grubuna AI Overviews ve AI Mode için **Generative AI performance** izlenim raporu sunmaya başladı; erişim varsa aylık ek sinyal olarak dışa aktarılır. Bu rapor citation metnini, mention'ı, recommendation'ı veya ChatGPT/Claude görünürlüğünü ölçmez; bu yüzden manuel protokolün yerine geçmez. Kaynak: [Google Search Console Generative AI performance](https://support.google.com/webmasters/answer/16984139).

## `llms.txt` deneyi ve geri alma

`/llms.txt` yalnız yayımlanmış altı P0 canonical public URL'yi listeler; yeni ürün iddiası içermez. İlk yayın günü kaydedilir. Üç aylık deney boyunca aylık prompt sonuçları ve crawler logları karşılaştırılır; dosyanın keşfedilmesi/etkisi kanıtlanamazsa veya stale/yanlış URL oluşursa route ve middleware allow-list girdisi tek PR ile kaldırılır. Growth/Product çeyreklik kontrolde URL'leri sitemap ve canonical çıktısıyla karşılaştırır.
