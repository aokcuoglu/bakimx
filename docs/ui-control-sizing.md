# UI kontrol boyutları

Uygulama kontrolleri telefonda en az 44 px dokunma alanı kullanır. `md` ve üzerindeki form kontrolleri 36 px (`h-9`) yüksekliğindedir.

| Kontrol | Mobil | `md+` | Yoğun masaüstü |
| --- | --- | --- | --- |
| Button (`default`, `xs`, `sm`) | `h-11` | `h-9` | `size="compact"`: mobil `h-11`, `md+ h-8` |
| Birincil CTA (`lg`) | `h-12` | `h-9` | Kullanılmaz |
| İkon Button | `size-11` | `size-9` | `size="icon-compact"`: mobil `size-11`, `md+ size-8` |
| Input | `h-11` | `h-9` | Özel sınıfla küçültülmez |
| Select | `h-11` | `h-9` | `size="compact"`: mobil `h-11`, `md+ h-8` |

`compact` yalnız yoğun yönetim tabloları ve araç çubukları içindir; normal formlarda kullanılmaz. Boyut sınıfları çağrı yerinde `h-*` / `size-*` ile ezilmez.

Ham HTML etkileşimli kontrol kullanılmaz. Form gönderimi için kullanıcıya görünmeyen `input[type="hidden"]` alanları istisnadır. Uygulamanın ürettiği bağımsız ödeme/çıktı HTML belgeleri React bileşen ağacının dışında olduğundan bu kurala dahil değildir.
