# Canlı Destek (Live Chat) — BAK-73

www.bakimx.com ziyaretçileri ile BakımX destek ekibi arasındaki uçtan uca yazışma
sistemi. **Kiracıya ait değildir**: bu, BakımX şirketinin kendi destek masasıdır,
bu yüzden hiçbir tabloda `workshopId` yoktur ve yönetimi yalnız `/admin`
konsolundan yapılır. Atölyelerin kendi müşterileriyle iletişimi ayrı bir konudur
(`CommunicationLog`, iş emri zaman çizelgesi) ve buraya karışmaz.

## Ekranlar

| Nerede | Ne yapar |
|---|---|
| Widget → **Canlı destek** | Ziyaretçi sohbeti başlatır ve yazışır. Menüde çevrimiçi/çevrimdışı rozeti görünür. |
| `/admin/live-chat` | Gelen kutusu: görüşme listesi + yazışma + yanıt kutusu. 5 sn'de bir tazelenir. |
| `/admin/live-chat/settings` | Çalışma günleri/saatleri, kapalı günler, otomatik mesajlar, açma/kapama. |
| Admin sol menü | "Canlı Destek" satırında yanıt bekleyen görüşme sayısı rozeti. |

Widget yalnız public sayfalarda çıkar — kapsam `src/lib/site-assistant-visibility.ts`
içinde, uygulama/`admin` yollarında hiç render edilmez.

## Veri modeli

- `LiveChatSettings` — tek satır (`id = "singleton"`). `schedule` alanı Json'dur;
  şekli `parseWeeklySchedule` ile doğrulanır, bozuk değer sessizce varsayılana
  düşer. Okuma yolu (`getLiveChatConfig`) satır yoksa `upsert` ile oluşturur,
  var olanı **asla ezmez** — yani migration'ın veri seed'lemesi gerekmez.
- `LiveChatConversation` — ziyaretçi kimliği `publicToken`dır (oturum yok,
  `VehiclePassportToken` ile aynı desen). Token tarayıcıda `localStorage`'da
  durur; ziyaretçi sayfalar arasında gezinse de sohbet devam eder.
- `LiveChatMessage` — `sender`: `visitor` | `agent` | `system`. `system`
  otomatik karşılama/çevrimdışı metinleridir; gelen kutusu önizlemesinde atlanır.

Okundu durumu **sayaç değil zaman damgasıdır** (`agentLastReadAt`,
`visitorLastReadAt`). Sayaç eşzamanlı iki yazmada bozulur; damga idempotenttir:
`okunmamış = lastVisitorMessageAt > agentLastReadAt`.

`prod-reset.ts` sınıflandırmasında üç tablo da **KEEP** listesindedir — kiracı
sıfırlaması destek geçmişini ve çalışma saatlerini silmemeli.

## Müsaitlik hesabı

`src/lib/live-chat/schedule.ts` tamamen saf bir katmandır: ne Prisma ne de
`new Date()` içerir, her fonksiyon `now`'u parametre alır. Tek doğruluk kaynağıdır
— widget, API ve admin aynı fonksiyonu çağırır.

Sunucu UTC'de (ECS), yönetici Türkiye'de. Karşılaştırma bu yüzden ham `Date`
üzerinde değil, `Intl.DateTimeFormat` ile hedef saat dilimine çevrilmiş **duvar
saati** üzerinde yapılır. Gelecekteki bir açılışın mutlak `Date` karşılığı
üretilmez (DST kenar durumu); "sonraki açılış" takvim günü + saat olarak tarif
edilir ve `describeNextOpening` bunu cümleye çevirir.

Kurallar:

- Bitiş saati **dışlayıcıdır**: 09:00–18:00 penceresinde 18:00'da kapalıyız.
- Gece aşırı pencere yoktur; `end <= start` geçersizdir ve o günün varsayılanına
  düşer (zod ayrıca formda reddeder).
- `holidays` (YYYY-MM-DD) çalışma saatinden bağımsız olarak o günü kapatır.
- `enabled = false` widget'ı tamamen gizler; ziyaretçi destek formunu kullanır.

Davranışın tamamı `src/lib/live-chat/schedule.test.ts` içinde sabitlenmiştir
(21 test): saat dilimi kayması, gün sınırı, gece yarısı normalizasyonu, tatil,
tüm günler kapalıyken sonsuz döngü olmaması.

## Neden yoklama (polling), WebSocket/SSE değil

Uygulama ECS Fargate'te **birden çok görev** olarak koşuyor ve ortak bir pub/sub
(Redis) **yok**. Bir görevde tutulan SSE akışı, mesajı yazan diğer görevden haber
alamaz — "gerçek zamanlı" görünüp sessizce mesaj düşüren bir sistem olurdu.
Next.js route handler'ları zaten WebSocket sonlandırmıyor.

Yoklama her görevde doğru çalışır:

- Ziyaretçi: panel açıkken 4 sn (`document.hidden` iken durur), `?after=` imleci
  ile yalnız yeni mesajları çeker.
- Admin: `router.refresh()` ile 5 sn'de bir yumuşak yenileme — ayrı bir yoklama
  uç noktası yok, tek veri kaynağı sayfanın kendisi ve yazılmakta olan yanıt
  metni korunur.

Gerçek zamanlı push gerekirse doğru adım Redis pub/sub + ayrı bir soket
servisidir; bu değişiklik yoklama arayüzünü bozmadan yapılabilir.

## Güvenlik ve kötüye kullanım

- Public uç noktalar `startConversationSchema` / `sendMessageSchema` ile
  **sunucu tarafında** doğrulanır; istemci doğrulaması yalnız hızlı geri bildirim.
- Token 24 rastgele bayttır (`randomBytes(24).toString("base64url")`) ve tek
  erişim anahtarıdır; uzunluk sınırı dışında tahmin edilebilir bir yapısı yoktur.
- Akış sınırı süreç içidir (`/api/support-request` ile aynı desen ve aynı bilinen
  sınır: çok görevli dağıtımda gerçek üst sınır görev sayısıyla çarpılır). Amaç
  kararlı bir saldırıyı durdurmak değil, kazara/basit spam'i ucuza kesmek.
- Admin tarafı `requireAdminCapability("manageLiveChat")` ile korunur — sayfa
  kapısı devralınmaz, her server action kapıyı yeniden çağırır.
- Ziyaretçi IP'si ve user-agent'ı görüşmede saklanır (spam teşhisi). Kişisel veri
  saklama süresi ürün kararıdır; şu an otomatik temizlik **yoktur**.

## Bilinçli kapsam dışı

- **E-posta bildirimi yok.** Mesai dışı gelen mesaj yalnız gelen kutusuna düşer;
  yöneticiye e-posta gitmez. `sendSystemEmail` zorunlu `workshopId` istediği için
  (kiracı iletişim kaydına bağlıdır) buraya doğrudan uymuyor — eklenecekse ayrı
  bir "platform bildirimi" yolu gerekir.
- **Dosya/görsel eki yok**, yazı tabanlı.
- **Birden çok destek temsilcisi için atama/sahiplenme yok** — tüm yöneticiler
  aynı gelen kutusunu görür. `agentEmail` her yanıtta saklandığı için kimin
  yazdığı bellidir.
- **Yazıyor… göstergesi yok** (yoklama ile anlamlı çalışmaz).
