export const IS_EMRI_REHBER_PATH = "/rehber/oto-servis-is-emri-nasil-hazirlanir" as const

export const IS_EMRI_REHBER_TITLE = "Oto Servis İş Emri Nasıl Hazırlanır? Uygulanabilir Standart"

export const IS_EMRI_REHBER_H1 = "Oto servis iş emri nasıl hazırlanır: eksiksiz bir kayıtta olması gereken 6 unsur"

export const IS_EMRI_REHBER_DESCRIPTION =
  "Eksiksiz bir oto servis iş emrinde hangi bilgilerin neden yer alması gerektiğini öğrenin: iş tanımı, parça ve işçilik kalemleri, fotoğraf kanıtı, müşteri onayı ve işlem geçmişi. BakımX ekranından örneklerle."

export const IS_EMRI_REHBER_INTRO =
  "Eksiksiz bir oto servis iş emri; aracın servise geliş nedenini ve yapılacak işleri, kullanılan parça ve işçilik kalemlerini, kabul/onarım fotoğraflarını, müşterinin teklife verdiği onayı ve kim-ne-zaman yaptı bilgisini tek kayıtta tutar. Bu altı unsurdan biri eksik kaldığında iş emri; kapsam anlaşmazlığına, kayıp maliyet kalemine veya kanıtsız hasar iddiasına açık kalır. Aşağıda her unsurun neden gerektiği ve BakımX'te nasıl uygulandığı örnek ekranla gösteriliyor."

export const IS_EMRI_REHBER_BOUNDARY =
  "Bu rehber; yeni açılan bir oto servisin, kağıt veya Excel'den dijital iş emrine geçen bir atölyenin ya da mevcut sürecini standartlaştırmak isteyen bir ekibin kullanacağı operasyonel bir kontrol listesidir. Bir vergi, muhasebe veya hukuki sözleşme şablonu değildir; indirilebilir bir belge sunmaz, adımları BakımX uygulamasındaki gerçek iş emri ekranı üzerinden gösterir."

export interface IsEmriRehberUnsur {
  title: string
  what: string
  why: string
  proof: string
}

export const IS_EMRI_REHBER_UNSURLAR: readonly IsEmriRehberUnsur[] = [
  {
    title: "İş tanımı",
    what: "Aracın servise geliş nedeni (arıza, hasar, bakım, kontrol, aksesuar) ve yapılacak işler madde madde yazılı olmalı.",
    why: "Kapsam belirsizliği, iş emri anlaşmazlıklarının en sık nedenidir; yazılı iş tanımı neyin kapsamda olduğunu netleştirir.",
    proof:
      "BakımX'te aracın geliş nedeni iş emrine kaydedilir, yapılacak işler ise kabul/onarım/teslim kategorisinde ayrı ayrı maddeler olarak tutulur ve tamamlanma durumu işaretlenir.",
  },
  {
    title: "Parça kalemleri",
    what: "Kullanılan her parça; adı, miktarı ve fiyatıyla ayrı bir kalem olarak iş emrine eklenmeli.",
    why: "Kalem bazlı kayıt, maliyeti şeffaf tutar ve stok hareketini iş emriyle eşler.",
    proof:
      "BakımX'te parça kalemi kataloğunuzdan seçildiğinde iş emrine eklenir ve stoktan otomatik düşer; kalem satırı hangi parça stok kaydına bağlı olduğunu tutar.",
  },
  {
    title: "İşçilik kalemleri",
    what: "Yapılan işçilik de parça gibi ayrı kalem olarak, adı ve tutarıyla iş emrine yazılmalı.",
    why: "İşçilik tutarı parça maliyetine karışırsa müşteri neye ne kadar ödediğini göremez.",
    proof: "BakımX'te işçilik kalemleri kendi kataloğunuzdan seçilir ve parça kalemlerinden ayrı satırlarda tutulur.",
  },
  {
    title: "Fotoğraf kanıtı",
    what: "Kabul ve onarım sırasında çekilen fotoğraflar iş emrine bağlı kalmalı; silinen bir kare bile denetimde iz bırakmalı.",
    why: "Anlaşmazlık anında sözlü ifade değil, zaman damgalı görsel kanıt geçerli olur.",
    proof:
      "BakımX'te fotoğraf kaydı soft-delete'tir: kaldırılan bir kare yalnız galeriden/PDF'ten çıkar, dosya ve kayıt saklı kalır; bazı fotoğraf türleri (ör. ön/arka/yan, kilometre) iş emrinde zorunlu olarak işaretlenebilir.",
  },
  {
    title: "Müşteri onayı",
    what: "Kalemleri içeren teklif müşteriye gösterilmeli; onay ya da ret kararı kayıt altına alınmalı.",
    why: "Sözlü onay ispatlanamaz; onaylanmamış bir iş için işçilik başlarsa ödeme anlaşmazlığı doğar.",
    proof:
      "BakımX'te teklif taslak olarak hazırlanır, müşteriye gönderilir ve durumu (onaylandı/reddedildi) kayıtta ilerler; onaylanan teklif iş emrine dönüştürülebilir.",
  },
  {
    title: "İşlem geçmişi",
    what: "İş emrindeki her değişikliğin kim tarafından ve ne zaman yapıldığı ayrı bir kayıt olarak tutulmalı.",
    why: "Ekip değişikliği ve hesap verebilirlik, geçmişi olmayan bir kayıtta doğrulanamaz.",
    proof: "BakımX'te iş emrine bağlı her değişiklik; işlemi yapan kullanıcı, eylem türü ve zaman damgasıyla ayrı bir denetim kaydına işlenir.",
  },
] as const

export const IS_EMRI_REHBER_FAQS = [
  {
    question: "Bu rehberden indirilebilir bir iş emri şablonu (Word/Excel) alabilir miyim?",
    answer:
      "Hayır. Bu rehber indirilebilir bir belge sunmaz; eksiksiz bir iş emrinde olması gereken altı unsuru ve bunların BakımX'teki gerçek ekranda nasıl uygulandığını, örnek veriyle gösterir. Kağıt veya Excel şablonu yerine, adımları doğrudan uygulamanın kendi iş emri ekranından görmek isteyenler için hazırlanmıştır. Dijital iş emrini görmek için ürün sayfasını inceleyebilirsiniz.",
  },
  {
    question: "İş emrinde ıslak imza şart mı?",
    answer:
      "Bu rehber hukuki bir tavsiye vermez; ıslak imza gerekip gerekmediğine kendi işletme politikanıza göre karar vermelisiniz. BakımX'te müşteri onayı, kalemleri içeren teklifin müşteriye gönderilip kararının (onaylandı veya reddedildi) dijital olarak kayda geçmesiyle izlenir; bu kayıt, iş emrinin onay durumunu ıslak imza olmadan da izlenebilir kılar.",
  },
  {
    question: "Fotoğraf eklemeden iş emri tamamlanabilir mi?",
    answer:
      "BakımX'te bazı fotoğraf türleri (örneğin ön/arka/yan görünüm, kilometre) zorunlu olarak işaretlenebilir; zorunlu kılınan bir fotoğraf eksikse kabul ekranında ayrıca listelenir ve tamamlanmadan geçilemez. Zorunlu olmayan diğer fotoğraf türleri (ör. hasar detayı) isteğe bağlı kalır ve iş emri onlar olmadan da ilerleyebilir.",
  },
  {
    question: "Teklif reddedilirse iş emrindeki kalemler silinir mi?",
    answer:
      "Hayır. Teklif ile iş emri BakımX'te ayrı kayıtlardır; reddedilen bir teklif kendi durumunda (reddedildi) kalır ve iş emrindeki mevcut parça/işçilik kalemlerini silmez. Onaylanan bir teklif ise tek adımda iş emrine dönüştürülebilir, böylece kalem listesini yeniden girmeye gerek kalmaz; ret durumundaki bir teklifi yeniden düzenleyip tekrar gönderebilirsiniz.",
  },
  {
    question: "Parça ve işçilik kalemlerini kim ekleyebilir?",
    answer:
      "Kalem ekleme, iş emri düzenleme yetkisi olan ekip üyesiyle sınırlıdır; yetkisiz bir kullanıcı kalem ekleyemez veya değiştiremez. Ayrıca her iş emri kendi atölye kaydınıza bağlı kalır — başka bir atölyenin iş emrine erişilemez, kalemi görüntülenemez veya eklenemez; bu sınır her sorguda otomatik uygulanır, ekibin ayrıca ayarlaması gerekmez.",
  },
] as const
