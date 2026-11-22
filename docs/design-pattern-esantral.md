# e-santral.com/bakimx — tasarım kalıbı (uygulama içi revizyon için)

Kaynak: `https://e-santral.com/bakimx/` + `style.css?v=12`, 22 Kasım 2026'da çekildi.
Kaynak CSS'in kendi tanımı: *"Apple tadında: sistem yazısı (SF Pro), düz açık gri
kutular, ürün sahnede"*. Uygulama içi için asıl referans, hero'daki **telefon
ekranı maketi** (`.d-screen`): sayfa uygulamanın nasıl görünmesi gerektiğini orada
çiziyor. Pazarlama ölçekleri (76px H1, 110px bölüm boşluğu) iç ekranlara taşınmaz.

> ⚠️ **Çatışma:** `DESIGN.md` bugün Attio'yu tek kaynak ilan ediyor (28px düğme,
> 8px köşe, `#266DF0`, `#FBFBFB` zemin). Bu kalıp ona birçok noktada ters
> (hap düğme, 44px dokunma, iOS grouped zemin, büyük köşe). Revizyona geçmeden
> önce `DESIGN.md`'nin hangi bölümlerinin yerini alacağı kararlaştırılmalı.

## 1. Tasarım ilkeleri

1. **iOS "grouped list" dili.** Açık gri zemin üstünde beyaz, kenarlıksız, büyük
   köşeli kartlar. Ayrım çizgiyle değil, zemin/kart kontrastıyla yapılır.
2. **Gölge yok, çerçeve yok.** Kartlar düz; derinlik yalnız modal ve sticky barda
   (blur) var.
3. **Tek vurgu rengi.** Mavi yalnız birincil eylem, seçili sekme ve ikon çizgisinde.
   Durum renkleri pastel zemin + koyu metin hap olarak.
4. **Sıkı negatif harf aralığı.** Başlıklar −0.03…−0.045em, gövde −0.01em. Kalın
   (700) başlık + gri (#6e6e73) açıklama ikilisi her yerde.
5. **Plaka görsel bir nesne.** TR plaka çerçeveli rozet olarak çizilir; satırın
   kimliği odur.
6. **Mobil önce, başparmak menzili.** Alt sekme çubuğu, 44px dokunma alanı,
   alttan açılan sheet modal.

## 2. Token'lar

### Renk

| Rol | Değer | Not |
|---|---|---|
| Metin (ink) | `#1d1d1f` | birincil metin |
| İkincil metin | `#6e6e73` | açıklama, alt bilgi |
| Üçüncül metin | `#86868b` | satır alt yazısı, tarih, etiket |
| Pasif ikon/sekme | `#8e8e93` | |
| Uygulama zemini | `#f2f2f7` | iOS grouped background (maket) |
| Yumuşak yüzey | `#f5f5f7` | pazarlama kutuları, footer |
| Kart | `#ffffff` | |
| Satır ayırıcı | `#f0f0f3` | kart içi |
| Çizgi | `#d2d2d7` / `#e5e5ea` | form, sekme barı üst çizgisi |
| Nötr düğme zemini | `#e8e8ed` → hover `#dcdce1` | yuvarlak ikon düğmeleri, kapat |
| Birincil | `#0071e3` → hover `#0077ed` | |
| Bağlantı | `#0066cc` | |
| Odak halkası | `0 0 0 4px rgba(0,113,227,.18)` | |
| Hata | `#e30000` (çerçeve), `#d70015` (metin) | |
| WhatsApp | `#25d366` | |

**Durum hapları** (pastel zemin / koyu metin):

| Durum | Zemin | Metin | Örnek |
|---|---|---|---|
| Bilgi / işlemde | `#e8f0fe` | `#0066cc` | İşlemde, Kabul |
| Uyarı / bekliyor | `#fff4e0` | `#a05a00` | Parça, Stok azaldı |
| Başarı / hazır | `#e6f5ea` | `#1b7a3d` | Hazır, onay ikonu |

### Tipografi

Yazı ailesi: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
"Inter", "Helvetica Neue", system-ui, sans-serif` + `-webkit-font-smoothing:
antialiased`. BakımX'te 22 Kasım 2026'dan beri Inter yüklenmiyor; `--font-sans`
`globals.css` `:root`'ta sistem yığınına bağlı (SF Pro / Segoe UI / Roboto).

Uygulama ölçeği (maketten, 350px genişlik referansı):

| Rol | Boyut / ağırlık / harf aralığı |
|---|---|
| Ekran başlığı (büyük başlık) | 25px / 700 / −0.03em / lh 1.1 |
| Başlık altı (tarih, bağlam) | 13px / 400 / `#86868b` |
| KPI rakamı | 20px / 700 / −0.02em |
| KPI etiketi | 11px / `#86868b` |
| Bölüm başlığı (liste üstü) | 12px / 600 / `#86868b`, 4px sola girinti |
| Satır birincil | 13px / 600 |
| Satır ikincil | 11.5px / 400 / `#86868b`, tek satır + ellipsis |
| Hap / rozet | 11px / 600 |
| Sekme barı etiketi | 10.5px / 500 |
| Gövde (form, metin) | 17px masaüstü / 16px mobil, lh 1.5, −0.01em |
| Modal başlığı | 30px (mobil 26px) / 700 / −0.035em |

Not: Maket ölçeği 0.7 küçültülmüş telefonda okunuyor; gerçek ekranda satır metni
**15–17px**, alt yazı **13px** olmalı (iOS: body 17, subhead 15, footnote 13,
caption 12).

### Köşe ve boşluk

| Öğe | Köşe |
|---|---|
| KPI kutusu, ikon kutusu (34px) | 14px / 10px |
| Liste kartı, bildirim kartı | 16px |
| Özellik kartı | 24–28px (mobil 22px) |
| Modal | 30px; mobil sheet `26px 26px 0 0` |
| Input | 12px |
| Düğme, hap, avatar | 999px / 50% |

Boşluk ritmi: kart içi 10–12px, kartlar arası 8px, bölümler arası 14px, ekran
yatay kenarı 16–18px. Taban birim ~4px.

## 3. Bileşen kalıpları

**Uygulama başlığı (app bar).** Solda logo/ekran adı, sağda 30px yuvarlak avatar
(baş harfler, `#dfe7ff` zemin, `#0066cc` metin). Altında büyük başlık + gri bağlam
satırı ("Bugün · Cumartesi, 22 Kasım").

**KPI şeridi.** 3 kolonlu grid, 8px aralık; her kutu beyaz, 14px köşe, 10px iç
boşluk; kalın rakam üstte, küçük gri etiket altta. ("7 Serviste · 3 Hazır ·
₺18,4B Kasa")

**Gruplu liste (iş emri satırı).** Tek beyaz kart (16px), satırlar arası 1px
`#f0f0f3` çizgi, ilk satırda çizgi yok. Satır: `[plaka rozeti] [araç + iş özeti] [durum hapı]`,
10px aralık, 9×12px iç boşluk. Orta kolon `min-width:0` + ellipsis.

**Plaka rozeti.** 1.5px `#1d1d1f` çerçeve, 5px köşe, 700 ağırlık, +0.02em,
`white-space:nowrap`. Plaka DB'de kompakt saklanır; gösterimde `34 ABC 123`
biçimlenir.

**Bildirim / aktivite kartı.** Ayrı beyaz kartlar (16px, 8px alt boşluk):
`[34px ikon] [kalın başlık + gri alt satır]`. İkon tipleri: yuvarlak WhatsApp
(yeşil, beyaz tik), kare 10px köşeli uyarı (`#fff4e0`), kare takvim
(`#e8f0fe`, saat yazısı). Üstünde "Az önce" gibi bölüm başlığı.

**Alt sekme çubuğu.** 4 eşit kolon, `rgba(255,255,255,.92)` + üst çizgi `#e5e5ea`,
22px çizgi ikon (stroke 1.8, round) + 10.5px etiket; seçili `#0071e3`, pasif
`#8e8e93`. Safe-area için alt dolgu.

**Sticky üst bar.** `rgba(255,255,255,.85)` + `backdrop-filter: saturate(180%) blur(20px)`,
alt çizgi `rgba(0,0,0,.08)`, 68px (mobil 58px).

**Düğmeler.**
- Birincil: hap, 44px (büyük 50px), `0 22px` dolgu, 17px / 500, mavi dolgu, gölge yok.
- İkincil: düz mavi metin bağlantısı + `›` ("Sizi arayalım ›"), hover'da altı çizili.
- Nötr ikon düğmesi: 44px (kapat 32px) daire, `#e8e8ed`.
- Mobilde CTA'lar dikey yığılır, birincil tam genişlik (max 320px).

**Form (yüzen etiket).** 58px input, 12px köşe, 1px `#86868b` çerçeve, etiket
içeride 17px; odakta/doluyken 12px'e küçülüp yukarı kayar ve maviye döner; odak
halkası 4px mavi %18. Hata: kırmızı çerçeve + 4px kırmızı %10 halka. Parola
göster/gizle sağda mavi metin düğmesi. Tek sütun, alanlar arası 12px.

**Modal.** Ortalanmış, 500px, 30px köşe, `0 40px 100px -30px rgba(0,0,0,.45)`
gölge; arka plan `rgba(0,0,0,.32)` + 10px blur. Ortada logo, başlık, gri alt
metin. Mobilde alttan açılan sheet. Giriş animasyonu `translateY(18px) scale(.98)`
→ 0, 320ms `cubic-bezier(.2,.8,.2,1)`. Başarı durumu: 64px yeşil daire içinde tik.

**Özellik kutusu.** `#f5f5f7`, 28px köşe, 34/30px dolgu; 34px mavi çizgi ikon →
22px/700 başlık → 17px gri açıklama.

**Numaralı adımlar.** 36px beyaz daire içinde mavi sayı, satırlar arası 1px
`#d2d2d7` çizgi.

**Akordeon (SSS).** Sadece alt çizgi, 19px/600 başlık, sağda 45° dönen chevron.

**Hareket.** Kaydırınca belirme `translateY(24px)` → 0, 800ms; `prefers-reduced-motion`
saygılı.

## 4. BakımX uygulama içine eşleme

| Bugün (Attio) | e-santral kalıbı | Etki |
|---|---|---|
| `--background` `#FBFBFB` | `#f2f2f7` | içerik alanı grouped zemin |
| Kart: beyaz + `#EEEFF1` çizgi | beyaz, **çizgisiz**, 16px köşe | `Card` varyantı |
| `--primary` `#266DF0` | `#0071e3` | kontrast testleri yeniden ölçülmeli (`theme-tokens.test.ts`) |
| Düğme 28px / 8px köşe | 44px hap (mobil), masaüstünde 36–40px hap | `control-sizing.test.ts` ölçeği değişir |
| `--radius` 10px | kart 16, input 12, hap 999 | `Rounded` skalası |
| Tablo satırı 36px | gruplu liste satırı, plaka rozeti + durum hapı | iş emri / araç listeleri |
| Sol sidebar | mobilde alt sekme çubuğu (4 sekme), masaüstünde sidebar kalabilir | kabuk |
| Etiket alan üstünde | yüzen etiket | `Form` bileşenleri |
| Dialog 16px | 30px, mobil bottom sheet | `Dialog`/`Sheet` |

Önerilen ilk dilim (küçük, gözden geçirilebilir): **Dashboard** ekranı — büyük
başlık + bağlam satırı, KPI şeridi, "Serviste" gruplu listesi (plaka rozeti +
durum hapı), aktivite kartları. Token'ları (`--background`, `--primary`, kart
varyantı, hap varyantları, `PlateBadge`) orada kurup diğer ekranlara yaymak.

## 5. Açık kararlar

1. Bu kalıp `DESIGN.md`'deki Attio kararının **yerini mi alıyor**, yoksa yalnız
   mobil/teknisyen yüzeylerine mi uygulanıyor?
2. Birincil mavi `#0071e3`'e mi geçiyor, `#266DF0` mı kalıyor?
3. Masaüstünde yoğunluk: 44px hap düğmeler veri ekranlarında (tablolar, ayarlar)
   da mı geçerli, yoksa masaüstü için daha kompakt (36px) bir ölçek mi?
4. Karanlık mod: kaynak sayfada yok; iOS karşılığı (`#000` / `#1c1c1e` kart)
   tanımlanmalı mı?

## 6. Uygulama durumu (22 Kasım 2026, `design/esantral-dashboard`)

- **Dashboard içeriği:** `src/components/dashboard/surface.tsx` + `surface.module.css`
  (panel, satır, plaka, hap, ikon kutusu, istatistik). Gruplu zemin yalnız bu sayfada.
- **Kabuk (tüm sayfalar):** `src/components/layout/app-shell.module.css`. Sidebar:
  beyaz zemin, ince çizgi, 12px/600 gri grup başlıkları, 34px/10px köşe satırlar
  (mobil açılır menüde 44px), seçili öğe mavi ton, dolgulu arama kutusu, paket
  kartı. Üst bar ve mobil sekme çubuğu buzlu yarı saydam (`blur(20px)`), seçili
  sekme mavi. Ayarlar sidebar'ı kapsam dışında (kendi modülünü korur).
- Global token'lar değişmedi; onaydan sonra taşınacak.
