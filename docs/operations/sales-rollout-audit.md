# Satış rollout denetimi

`sales:rollout-audit`, satış danışmanı akışının devreye alınmasından önce eski
verideki riskli satırları kimlikleriyle raporlayan **salt okunur** komuttur. Veri
taşımaz, alan doldurmaz ve bulguları otomatik düzeltmez.

## Çalıştırma

Uygulamanın kullandığı veritabanı bağlantısı hazırken:

```sh
bun run sales:rollout-audit
bun run sales:rollout-audit -- --json
```

CI veya operasyon kapısında hata/uyarı bulgularının komutu başarısız sayması
istenirse:

```sh
bun run sales:rollout-audit -- --fail-on-findings
```

Varsayılan çalışma bulguları raporlar ve `0` döner. `--fail-on-findings`, en az
bir `error` veya `warning` bulunduğunda `2` döner; yalnız bilgi seviyesindeki
`legacy_manual_commission` kayıtları bu kapıyı düşürmez.

Production veritabanına karşı çalıştırmak bağlantı/tünel erişimi gerektirir ve
ayrı insan onay kapısına tabidir. Komut migration çalıştırmaz; production
migration veya veri düzeltme yetkisi vermez.

## Kategoriler

| Kategori | Anlamı | Beklenen operasyon |
|---|---|---|
| `advisor_customer_tenant_conflict` | Danışman kullanıcısı müşteri tenant'ına bağlıdır. | Hesabı taşımayın; tenant sahipliğini inceleyip ayrı satış e-postasıyla yeniden davet edin. |
| `won_lead_without_workshop` | Kazanılmış lead'in müşteri iş yeri yoktur. | Gerçek dönüşümü doğrulayın; atfı tahmin ederek doldurmayın. |
| `converted_lead_missing_advisor` | İş yerine dönüşen lead'in danışmanı yoktur. | Atama geçmişi ve ticari kayıtlarla inceleyin. |
| `sales_workshop_missing_advisor` | `sales_advisor` kaynaklı iş yerinde edinim danışmanı yoktur. | Güvenilir kaynak yoksa otomatik atıf yapmayın. |
| `lead_workshop_source_mismatch` | Danışmanlı lead'in iş yeri edinim kaynağı farklıdır. | Lead ve kayıt kaynağını birlikte doğrulayın. |
| `lead_workshop_attribution_mismatch` | Lead ve iş yeri farklı danışmanlara bağlıdır. | Kayıt linki ve atama geçmişini inceleyin. |
| `registration_link_attribution_mismatch` | Kullanılmış güvenli link, lead atfıyla eşleşmez. | Güvenlik/yarış durumu olarak araştırın. |
| `billing_tax_snapshot_invalid` | Brüt, KDV oranı veya KDV hariç net kuruş hesabı tutarsızdır. | Siparişi ve migration geçmişini inceleyin. |
| `legacy_manual_commission` | Eski manuel hakediş korunmuştur. | Tutarı değiştirmeden insan onayına alın. |
| `commission_snapshot_incomplete` | Yeni ledger kaydının kural/baz/oran/tutar şekli eksiktir. | Ödeme ve kural geçmişini inceleyin. |

## Rollout kaydı

JSON çıktısını tarih ve ortam bilgisiyle operasyon artefaktı olarak saklayın.
Kimlikler denetim için bilinçli olarak görünür; çıktıda parola, token, e-posta,
telefon veya bağlantı sırrı bulunmaz. Düzeltme gerekiyorsa her kategori ayrı,
geri alınabilir ve onaylı bir bakım işi olarak ele alınmalıdır.
