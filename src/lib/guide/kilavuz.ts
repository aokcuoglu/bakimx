export const KILAVUZ_PATH = "/kilavuz" as const

export const KILAVUZ_TITLE = "Kullanım Kılavuzu"

export const KILAVUZ_H1 = "BakımX kullanım kılavuzu"

export const KILAVUZ_DESCRIPTION =
  "BakımX’te kurulumdan araç kabulü teslimine kadar günlük servis akışını adım adım anlatan ürün kullanım kılavuzu: müşteri, araç, fotoğraf, teklif ve teslim."

export const KILAVUZ_INTRO =
  "Bu kılavuz, atölyenizde BakımX’i ilk günden verimli kullanmanız için yazıldı. Soldaki içindekilerden istediğiniz bölüme atlayabilir, üstteki arama ile konu bulabilir veya yazdırıp ekibinize dağıtabilirsiniz."

export const KILAVUZ_UPDATED_LABEL = "16 Eylül 2026"

export const KILAVUZ_CONTENT_OWNER = {
  role: "BakımX Ürün Ekibi",
  publishedAt: "2026-09-16",
  updatedAt: "2026-09-16",
} as const

export type GuideBlock =
  | { type: "p"; text: string }
  | { type: "ol" | "ul"; items: string[] }
  | { type: "tip" | "warning" | "note"; title?: string; text: string }
  | { type: "shot"; src?: string; alt: string; caption: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "links"; items: { label: string; href: string }[] }

export type GuideSection = {
  id: string
  title: string
  blocks: GuideBlock[]
}

export const KILAVUZ_SECTIONS: GuideSection[] = [
  {
    id: "ne-yapar",
    title: "BakımX ile ne yaparsınız",
    blocks: [
      {
        type: "p",
        text: "BakımX, oto servisler için mobil öncelikli bir iş yönetimi platformudur. Araç kabulü, fotoğraf ve hasar kaydı, teklif/onay ve teslim çıktısını tek yerde tutar; müşteriye WhatsApp veya link ile özet gönderebilirsiniz.",
      },
      {
        type: "ul",
        items: [
          "Müşteri ve araç künyesini bir kez kaydedip sonraki işlerde yeniden kullanın",
          "Araç kabulünü dakikalar içinde açın; parça ve işçilik kalemlerini ekleyin",
          "Kabul fotoğrafları ve hasar işaretleriyle kanıt bırakın",
          "Teklif ve kamu özet linkiyle müşteri onayını hızlandırın",
        ],
      },
      {
        type: "note",
        title: "Bu kılavuz nedir?",
        text: "Ürün kullanım kılavuzudur. SEO eğitim yazıları (/rehber/…) pazarlama içeriğidir; hukuki form şablonu veya paket fiyat taahhüdü değildir.",
      },
      {
        type: "links",
        items: [
          { label: "Ücretsiz hesap oluştur", href: "/register" },
          { label: "Demo talep et", href: "/demo" },
          { label: "Dijital araç kabul nedir?", href: "/dijital-arac-kabul" },
        ],
      },
    ],
  },
  {
    id: "hesap-kurulum",
    title: "Hesap, giriş ve kurulum",
    blocks: [
      {
        type: "p",
        text: "Self-servis kayıt bir deneme başvurusudur: /register ile hesap açılır, e-posta doğrulanır; iş yeri onayı sonrası panele girersiniz. Onaylanmamış hesaplar uygulamayı kullanamaz.",
      },
      {
        type: "ol",
        items: [
          "bakimx.com/register adresinden firma ve hesap bilgilerinizi girin",
          "Doğrulama e-postasındaki bağlantıyı açın",
          "Onay sonrası /login ile giriş yapın",
          "İlk girişte dört adımlı iş yeri kurulumunu (sektör, ihtiyaçlar, ekip, modüller) tamamlayın",
        ],
      },
      {
        type: "shot",
        alt: "İş yeri kurulum sihirbazı",
        caption: "Kurulum sihirbazı — sektör ve modül tercihleriniz kaydedilir; plan yetkilerini tek başına değiştirmez.",
      },
      {
        type: "tip",
        title: "İlk araç kabulüne giden yol",
        text: "Kurulumdan sonra Genel Bakış’ta ürün turu ve “ilk araç kabulü” kartı sizi yönlendirir. Müşteri ve aracı araç kabul ekranından da ekleyebilirsiniz.",
      },
      {
        type: "warning",
        title: "Geçici parola",
        text: "Yönetici size geçici parola verdiyse ilk girişte şifre değiştirme ekranı açılır; tamamlanmadan panele geçilemez.",
      },
    ],
  },
  {
    id: "gezinme",
    title: "Genel bakış ve gezinme",
    blocks: [
      {
        type: "p",
        text: "Girişten sonra Genel Bakış (dashboard) günlük nabzınızı gösterir: aktif işler, teslimatlar, uyarılar. Sol menü (masaüstü) veya alt menü (mobil) ile modüllere geçersiniz.",
      },
      {
        type: "table",
        headers: ["Alan", "Ne işe yarar"],
        rows: [
          ["Genel Bakış", "Özet KPI’lar, uyarılar, hızlı “Yeni Araç Kabul”"],
          ["Araç Kabulleri", "Açık/kapalı iş listesi ve detay"],
          ["Müşteriler / Araçlar", "Künye ve geçmiş"],
          ["Oluştur (+)", "Araç kabulü, teklif, randevu vb. hızlı oluşturma"],
          ["Arama", "Plaka, müşteri veya araç kabul numarası"],
        ],
      },
      {
        type: "shot",
        alt: "Genel bakış ekranı",
        caption: "Genel bakış — hoş geldiniz bandı, KPI’lar ve aktif işler.",
      },
      {
        type: "tip",
        text: "Mobilde alt menüde Panel, Araç Kabulleri, Teknisyen ve Müşteriler kısayolları vardır. Oluştur düğmesi üst çubuktadır.",
      },
    ],
  },
  {
    id: "musteri-arac",
    title: "Müşteri ve araç kaydı",
    blocks: [
      {
        type: "p",
        text: "Araç kabulünden önce veya araç kabul sırasında müşteri ve araç oluşturabilirsiniz. Aynı plaka sonraki işlerde yeniden bulunur; geçmiş kaybolmaz.",
      },
      {
        type: "ol",
        items: [
          "Müşteriler › Yeni veya araç kabul içinden müşteri ekleyin (ad, telefon)",
          "Araç eklerken plaka, marka/model ve mümkünse şase bilgisini girin",
          "Varsa ruhsat okuma (paketinize açıksa) ile alanları hızlandırın",
          "Kaydı kaydedip araç kabulüne bağlayın",
        ],
      },
      {
        type: "shot",
        alt: "Araç kayıt formu",
        caption: "Araç kaydı — plaka ve kimlik bilgileri sonraki aramalarda kullanılır.",
      },
      {
        type: "note",
        text: "Daha ayrıntılı saha kontrol listesi için Araç Kabul Formu rehberine bakın.",
      },
      {
        type: "links",
        items: [{ label: "Araç kabul formu rehberi", href: "/rehber/arac-kabul-formu" }],
      },
    ],
  },
  {
    id: "is-emri",
    title: "Araç kabulü oluşturma",
    blocks: [
      {
        type: "p",
        text: "Araç kabulü, servisteki işin omurgasıdır. Müşteri şikâyeti, araç, parça/işçilik kalemleri ve durum buradan yönetilir.",
      },
      {
        type: "ol",
        items: [
          "Oluştur › Araç kabulü veya Araç Kabulleri › Yeni",
          "Müşteri ve aracı seçin veya yerinde oluşturun",
          "Şikâyet / iş açıklamasını yazın",
          "Gerekirse parça ve işçilik satırları ekleyin",
          "Kaydedin; durum “açık / devam” olarak listelenir",
        ],
      },
      {
        type: "shot",
        alt: "Yeni araç kabul ekranı",
        caption: "Yeni araç kabulü — müşteri, araç ve kalemler tek akışta.",
      },
      {
        type: "tip",
        text: "Lite planda ilk araç kabulüne giden kısa yol Genel Bakış’taki karttan da açılır.",
      },
      {
        type: "links",
        items: [{ label: "Araç kabulü nasıl hazırlanır? (rehber)", href: "/rehber/oto-servis-is-emri-nasil-hazirlanir" }],
      },
    ],
  },
  {
    id: "foto-hasar",
    title: "Fotoğraf, hasar ve kabul",
    blocks: [
      {
        type: "p",
        text: "Kabul anındaki görseller ve hasar işaretleri teslimde tartışmayı azaltır. Paketinizde fotoğraf kontrol listesi açıksa araç kabulü veya kabul akışından kareleri tamamlayın.",
      },
      {
        type: "ul",
        items: [
          "Zorunlu açılar: ön, arka, yanlar, gösterge (işletme kuralınıza göre)",
          "Hasar haritasında bölge ve tür işaretleyin",
          "Eksik fotoğraf uyarılarını Genel Bakış veya araç kabul detayından takip edin",
        ],
      },
      {
        type: "shot",
        alt: "Hasar haritası ve fotoğraf alanı",
        caption: "Hasar ve fotoğraf — zaman damgalı kanıt için kabul anında tamamlayın.",
      },
      {
        type: "warning",
        text: "Fotoğraf ve hasar özellikleri plana bağlıdır. Menüde kilit görüyorsanız Paketler ekranından erişimi kontrol edin.",
      },
    ],
  },
  {
    id: "teklif-onay",
    title: "Teklif ve müşteri onayı",
    blocks: [
      {
        type: "p",
        text: "Teklif modülü açıksa iş kalemlerinden teklif oluşturup müşteriyle paylaşabilirsiniz. Public özet linki veya WhatsApp çıktısı ile onay sürecini hızlandırın.",
      },
      {
        type: "ol",
        items: [
          "Araç kabulünden veya Teklifler › Yeni ile teklif oluşturun",
          "Kalemleri ve tutarları gözden geçirin",
          "Müşteriye gönderin / public özeti paylaşın",
          "Onay veya revizyon durumunu araç kabulüne yansıtın",
        ],
      },
      {
        type: "shot",
        alt: "Teklif detayı",
        caption: "Teklif — müşteri onayı gelmeden işe başlamayı netleştirir.",
      },
    ],
  },
  {
    id: "ilerleme-teslim",
    title: "İş ilerletme ve teslim",
    blocks: [
      {
        type: "p",
        text: "Araç kabul durumunu güncelleyin; teknisyen paneli (ekip özelliği açıksa) sahadaki ustaya sade bir görev listesi sunar. Teslimde kilometre, ödeme ve müşteri bilgilendirmesini tamamlayın.",
      },
      {
        type: "ul",
        items: [
          "Durum: açık → devam → tamamlandı / teslim",
          "Teknisyen ataması ve ilerleme (pakete bağlı)",
          "Teslim notları ve tahsilat (kasa özelliği açıksa)",
        ],
      },
      {
        type: "shot",
        alt: "Araç kabul detay ve durum",
        caption: "Araç kabul detayı — durum, kalemler ve aktivite tek ekranda.",
      },
      {
        type: "tip",
        text: "Bugünkü teslimatlar Genel Bakış’ta ayrı bir listede toplanır; günü kapatmadan önce kontrol edin.",
      },
    ],
  },
  {
    id: "hatirlatmalar",
    title: "Bildirimler ve hatırlatmalar",
    blocks: [
      {
        type: "p",
        text: "Otomatik bakım hatırlatmaları ve bildirim ayarları paketinize bağlıdır. Açıkysa yaklaşan / geciken hatırlatmaları Genel Bakış widget’ından ve Hatırlatmalar menüsünden yönetirsiniz.",
      },
      {
        type: "ul",
        items: [
          "Ayarlar › Bildirimler ile kanalları kontrol edin",
          "Hatırlatma kaydı oluştururken araç ve periyodu seçin",
          "Gecikenleri önceliklendirin",
        ],
      },
      {
        type: "note",
        text: "Bildirimler menüsündeki zil şu an “yakında” olabilir; kritik iş uyarıları dashboard kartlarından da takip edilir.",
      },
    ],
  },
  {
    id: "sss",
    title: "SSS ve sorun giderme",
    blocks: [
      {
        type: "p",
        text: "Sık karşılaşılan durumlar:",
      },
      {
        type: "table",
        headers: ["Durum", "Ne yapmalısınız"],
        rows: [
          ["Menü satırı kilitli / PRO", "Paketler & Kullanım’dan özelliğin planınızda olup olmadığına bakın"],
          ["Kurulum penceresi kapanmıyor", "Tüm adımları tamamlayıp “Kurulumu Tamamla”ya basın"],
          ["Şifre değiştirmeye zorlanıyorum", "Geçici parola politikasıdır; yeni şifreyi kaydedin"],
          ["Araç kabulü / müşteri bulunamıyor", "Üst aramayı plaka veya telefon ile deneyin"],
          ["E-posta gelmedi", "Spam klasörü; gerekirse doğrulamayı yeniden gönderin"],
        ],
      },
      {
        type: "links",
        items: [
          { label: "İletişim", href: "/contact-us" },
          { label: "Sistem durumu", href: "/status" },
          { label: "Paketler ve fiyatlar", href: "/fiyatlar" },
        ],
      },
      {
        type: "note",
        title: "Gizlilik",
        text: "Kılavuzdaki örnek ekranlar demo verisiyle anlatılmıştır; canlı müşteri PII’si içermez. Gerçek ekran görüntüleri eklendiğinde de aynı kural geçerlidir.",
      },
    ],
  },
]

/** Flatten section text for client-side search. */
export function guideSectionSearchText(section: GuideSection): string {
  const parts = [section.title]
  for (const block of section.blocks) {
    switch (block.type) {
      case "p":
        parts.push(block.text)
        break
      case "tip":
      case "warning":
      case "note":
        if (block.title) parts.push(block.title)
        parts.push(block.text)
        break
      case "ol":
      case "ul":
        parts.push(...block.items)
        break
      case "shot":
        parts.push(block.alt, block.caption)
        break
      case "table":
        parts.push(...block.headers, ...block.rows.flat())
        break
      case "links":
        parts.push(...block.items.map((i) => i.label))
        break
    }
  }
  return parts.join(" ").toLocaleLowerCase("tr-TR")
}
