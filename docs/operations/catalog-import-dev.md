# DEV katalog içe aktarma

`/admin/catalog/import` CSV UTF-8 ve JSON kabul eder. JSON kökü bir nesne dizisi
veya Supabase dışa aktarımındaki gibi sayısal anahtarlı bir nesne olmalıdır.

Akış her zaman iki aşamalıdır:

1. Dosya, marka ve mod seçilir; **Ön izle** ürün tablosuna yazmaz.
2. Sunucu başlıkları ve satırları doğrular; yeni/güncellenecek/atlanan/hatalı
   sayılarını, örnek satırları ve SHA-256 dosya kimliğini kaydeder.
3. Hatalar kaynakta düzeltilip yeniden ön izlenir. Hatalı satırlar sessizce
   uygulanmaz.
4. **Uygula** aynı dosyayı tekrar gönderir. Hash ön izlemedekiyle eşleşmezse
   istek reddedilir; eşleşirse yazmalar tek transaction içinde uygulanır.

DEV'de önce küçük bir örnekle dry-run yapılmalı; sayılar onaylandıktan sonra tam
dosya uygulanmalıdır. Aynı SKU idempotensi anahtarıdır. Dosya içindeki yinelenen
SKU ve başka markaya ait mevcut SKU hatadır. PROD'a geçiş ayrı onay ve aynı dry-run
raporunun gözden geçirilmesini gerektirir.

## Wunderfilter örneği

Ekli `wunderfilter_urunler.json` 1.641 satır içerir. Alan eşlemeleri:

| Kaynak | BakımX alanı |
| --- | --- |
| `wunder_no` | Ürün Kodu |
| `oem_no` | OEM No |
| `aciklama` | Açıklama |
| `fiyat_tl` | Fiyat |
| `image_url` | Görsel URL |

Dosya doğrudan uygulanmaya hazır değildir: Ürün Adı ve Stok kolonları yoktur,
1.640 satırda fiyat boştur ve 126 ürün kodu yinelenir. `marka` ürün üreticisi
değil araç markası, `cinsi` ise iç kategoriye çevrilmesi gereken kaynak değeridir
(`KABIN→polen-filtresi`, `MAZOT/BENZIN→yakit-filtresi`, `HAVA→hava-filtresi`,
`YAG→yag-filtresi`). Bu kararlar kaynak sahibiyle netleşmeden fiyatı/stoku sıfır
varsayarak ürün açılmamalıdır.

Hazırlanan dosyada tam ürün modu için en az `Ürün Kodu`, `Ürün Adı`, `Fiyat
(KDV hariç)` ve `Stok` bulunmalıdır. Kaynak `marka` alanı ürün markası kolonuna
konmamalı; gerekiyorsa açıklamaya veya ileride ayrı uyumluluk modeline taşınmalıdır.
