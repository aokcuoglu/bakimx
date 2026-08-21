# Landing ve public rota performansı

Ölçüm aracı, taban (baseline) değerler ve landing'de neyin neden böyle
kurgulandığı. Kaynak: BAK-165.

## Ölçüm nasıl tekrarlanır

`scripts/measure-landing-payload.mjs` bir sayfanın HTML'ini çeker, ilk yüklemede
indirilen `/_next/` script ve stil varlıklarını toplar ve transfer boyutunu
brotli ile ölçer. Tarayıcı gerektirmez, deterministiktir.

```sh
bun run build
bun run start --port 3187 &
MEASURE_BASE_URL=http://127.0.0.1:3187 \
  node scripts/measure-landing-payload.mjs / /oto-servis-programi /is-emri-programi
```

Karşılaştırma yaparken iki koşuyu da **aynı** ortam değişkenleriyle al —
`NEXT_PUBLIC_ANALYTICS_ENABLED` açıkken paket bir miktar büyür, öncesi/sonrası
farklı bayraklarla ölçülürse fark anlamsızlaşır.

## Taban değerler

`origin/dev` @ `2ce3555`, `NEXT_PUBLIC_ANALYTICS_ENABLED` ayarsız:

| Rota | JS (br) | HTML (gzip) | CSS (br) |
|---|---|---|---|
| `/` | 347.2 kB → **241.0 kB** | 26.3 kB → 34.2 kB | 24.2 kB → 24.4 kB |
| `/oto-servis-programi` | 339.8 kB → **219.6 kB** | 16.0 kB → 17.7 kB | 24.2 kB → 24.4 kB |
| `/is-emri-programi` | 339.8 kB → **219.6 kB** | 15.0 kB → 16.8 kB | 24.2 kB → 24.4 kB |

HTML'in büyümesi beklenen bir takastır, kayıp değil: istemci sınırı aşağı indiği
için section içerikleri artık RSC yükünde taşınıyor. `/` için toplam transfer
397.7 kB → 299.6 kB (**−%24.7**).

## Landing'de neden framer-motion yok

En pahalı bulgu boyut değildi. `motion` bileşenleri `initial` değerlerini sunucu
HTML'ine satır içi `opacity:0` olarak basıyordu; `/` yanıtında böyle **70**
eleman vardı ve **LCP adayı `<h1>` de bunlardan biriydi**. Yani en büyük içerik
ögesinin boyanması framer-motion inip hidrasyon bitene kadar bekliyordu.

Ölçüm, landing'in tüm framer-motion kullanımının iki desende toplandığını
gösterdi — girişte bir kez oynayan `animate` ve görünüm alanına girince oynayan
`whileInView`. Karşılıkları:

- **Giriş** → `.enter-up` / `.enter-pop` (`globals.css`). Saf CSS, JS yok.
- **Kaydırmayla beliriş** → `components/shared/reveal.tsx` + `[data-reveal]`
  kuralları. Tek iş bir IntersectionObserver.
- **Tarama çizgisi** (`RuhsatDemoSection`) → `.ruhsat-scan-line` keyframe'i.
  Landing'de framer-motion'a duyulan tek gerçek özellik buydu.

Sonuç: `/` yanıtında satır içi `opacity:0` sayısı **70 → 0**.

`framer-motion` bağımlılık olarak DURUYOR — auth formları, `photo-lightbox` ve
`purchase-wizard` kullanıyor. Landing'e geri sızmasın: yeni bir section'da
animasyon gerekiyorsa önce yukarıdaki üç yardımcıya bak.

## Gizli kalma riski ve iki kaçış yolu

`Reveal` gizliliği (`data-reveal="pending"`) **sunucuda** basar — istemcide
sonradan eklemek SSR çıktısı zaten boyanmış olduğu için her kartta titreme
bırakırdı. Bu yüzden içeriğin gözlemci hiç çalışmadığında da görünmesi gerekir;
iki kaçış yolu da JS gerektirmez:

1. **Hareket azaltma tercihi** — kurallar `prefers-reduced-motion: no-preference`
   içinde, `reduce` tercihinde hiç eşleşmez.
2. **JS kapalı** — `layout.tsx` bir `<noscript>` kuralıyla gizliliği geri alır.
   Kural `<head>`te stylesheet bağlantısından SONRA basılır; seçici özgüllüğü
   aynı olduğu için kaynak sırası belirleyicidir, sıra bozulursa kural ezilmez.

## Asistan paneli talep üzerine iner

`site-assistant.tsx` paneli `next/dynamic` ile ayırır. Panel zaten yalnız `open`
iken render ediliyordu ama statik `import` onu her sayfanın ilk yüküne
sokuyordu; canlı sohbet doğrulaması üzerinden **`zod` da** (51.4 kB br) bu yolla
giriyordu.

Dikkat: bunu tek başına yapmak yetmedi. `HeroAskBar` yalnızca
`ASSISTANT_PANEL_ID` sabiti için `assistant-panel.tsx`i statik import ediyor ve
ikinci bir yol açık bırakıyordu. Sabit artık `assistant-bridge.ts`te — köprü
ikisinin de bağımlılıksız ortak zemini. **Panelden landing'e sabit/tip
sızdırmayın; paylaşılan şey köprüye girer.**
