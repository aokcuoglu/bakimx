import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY, LegalPage, LegalSection } from "@/components/legal/legal-page";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  path: "/terms",
  title: "Kullanım Koşulları ve Hizmet Sözleşmesi",
  description: "BakımX oto servis yönetim platformunun kullanım koşulları ve hizmet sözleşmesi.",
});

export default function TermsPage() {
  return (
    <LegalPage
      slug="terms"
      title="Kullanım Koşulları ve Hizmet Sözleşmesi"
      intro={
        <>
          Bu Kullanım Koşulları ve Hizmet Sözleşmesi (&quot;Sözleşme&quot;),{" "}
          {COMPANY.brand} platformunu kullanan işletmeler ile {COMPANY.legalName}{" "}
          arasındaki hak ve yükümlülükleri düzenler. Platforma kayıt olarak veya
          hizmeti kullanarak bu Sözleşme&apos;yi kabul etmiş sayılırsınız.
        </>
      }
    >
      <LegalSection n={1} title="Taraflar ve Tanımlar">
        <p>
          <strong>Hizmet Sağlayıcı / Şirket:</strong> {COMPANY.legalName}
          {" — "}
          {COMPANY.address}. MERSİS No: {COMPANY.mersis}, Ticaret Sicil No:{" "}
          {COMPANY.tradeRegistryNo}, Vergi Dairesi/No: {COMPANY.taxOffice} /{" "}
          {COMPANY.taxNo}. Aşağıda &quot;{COMPANY.brand}&quot;, &quot;Şirket&quot;
          veya &quot;biz&quot; olarak anılacaktır.
        </p>
        <p>
          <strong>Kullanıcı / İşletme:</strong> Platforma kayıt olan ve hizmeti
          kendi oto servis / bakım operasyonu için kullanan gerçek veya tüzel
          kişi.
        </p>
        <p>
          <strong>Yetkili Kullanıcı:</strong> İşletme adına hesap açan veya
          işletme tarafından yetkilendirilen kişi.
        </p>
        <p>
          <strong>Platform / Hizmet:</strong> {COMPANY.website} ve{" "}
          {COMPANY.app} üzerinden sunulan {COMPANY.brand} oto servis yönetim
          yazılımı ve ilgili tüm modüller.
        </p>
        <p>
          <strong>Son Kullanıcı / Müşteri:</strong> İşletmenin kendi
          müşterileri; verileri işletme tarafından platforma girilen araç
          sahipleri ve ilgili kişiler.
        </p>
      </LegalSection>

      <LegalSection n={2} title="Sözleşmenin Konusu ve Hizmet Kapsamı">
        <p>
          {COMPANY.brand}, oto servisler için bulut tabanlı bir işletme yönetim
          platformudur. Hizmet, aşağıdaki modülleri içerebilir:
        </p>
        <ul>
          <li>Araç kabul (intake), müşteri ve araç kayıt yönetimi,</li>
          <li>İş emri oluşturma, parça/işçilik kalemleri ve fiyatlandırma,</li>
          <li>Fotoğraflı kontrol listesi ve araç üzerinde hasar işaretleme,</li>
          <li>
            Müşteriyle paylaşılan bağlantı üzerinden servis özeti ve onay,
          </li>
          <li>PDF çıktı ve WhatsApp/SMS ile bilgilendirme,</li>
          <li>
            Ruhsat/plaka için görüntüden metin okuma (OCR) ve yapay zeka destekli
            yardımcı özellikler,
          </li>
          <li>Araca uygun parça kataloğu ve raporlama.</li>
        </ul>
        <p>
          Modüllerin kullanılabilirliği seçilen abonelik planına ve platformun o
          günkü sürümüne göre değişebilir. Şirket, hizmet kapsamını geliştirme,
          değiştirme veya bazı özellikleri sonlandırma hakkını saklı tutar.
        </p>
      </LegalSection>

      <LegalSection n={3} title="Üyelik, Hesap Güvenliği ve Yetkili Kullanıcı">
        <p>
          Hesap açan kişi, işletme adına bu Sözleşme&apos;yi kabule yetkili
          olduğunu beyan eder. Kayıt sırasında verilen bilgilerin doğru, güncel
          ve eksiksiz olmasından Kullanıcı sorumludur.
        </p>
        <p>
          Kullanıcı, giriş bilgilerinin (e-posta, şifre) gizliliğinden ve hesabı
          üzerinden yapılan tüm işlemlerden sorumludur. Yetkisiz bir erişim veya
          şüpheli bir aktivite fark edildiğinde derhal{" "}
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> adresine bildirim
          yapılmalıdır.
        </p>
        <p>
          Her hesap kendi verilerine izole şekilde erişir; işletmelere ait
          veriler diğer işletmelerle paylaşılmaz.
        </p>
      </LegalSection>

      <LegalSection n={4} title="Deneme Süresi, Abonelik ve Ücretlendirme">
        <p>
          Kayıt sonrası işletmeye belirli süreli (güncel olarak 7 iş günlük) ücretsiz
          deneme sunulabilir. Deneme süresi ve kapsamı Şirket tarafından
          değiştirilebilir.
        </p>
        <p>
          Ücretli abonelikler, seçilen plana göre periyodik (aylık/yıllık) olarak
          faturalandırılır. Ücretsiz kayıt sırasında kart bilgisi istenmez.
          Ücretli satın alımlarda ödemeler lisanslı ödeme kuruluşu altyapısı
          üzerinden alınır; kart doğrulaması amacıyla düşük tutarlı bir ön
          provizyon (bloke) uygulanabilir ve bu tutar iade/serbest bırakılır.
        </p>
        <p>
          Güncel fiyatlar{" "}
          <Link href="/fiyatlar">fiyatlar sayfasında</Link> yer alır. Şirket,
          fiyatları ileriye dönük olarak değiştirebilir; değişiklikler mevcut
          fatura döneminin sonunda geçerli olur.
        </p>
        <p>
          Kartlı otomatik yenilemeli aboneliklerde Kullanıcı, aboneliğini
          panelinden veya destek kanalıyla iptal edebilir. Mesafeli Sözleşmeler
          Yönetmeliği kapsamındaki cayma ve iade hakları saklıdır.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Kullanıcı Yükümlülükleri ve Yasaklı Kullanım">
        <p>Kullanıcı, platformu kullanırken aşağıdakileri yapmamayı taahhüt eder:</p>
        <ul>
          <li>Yürürlükteki mevzuata aykırı, hukuka aykırı veya hak ihlali oluşturan içerik yüklemek,</li>
          <li>Üçüncü kişilere ait kişisel verileri, gerekli hukuki dayanak veya rıza olmaksızın işlemek,</li>
          <li>Alıcının onayı olmadan izinsiz toplu ticari elektronik ileti (spam) göndermek,</li>
          <li>Platformun güvenliğini test etmek, tersine mühendislik yapmak veya sistemi kötüye kullanmak,</li>
          <li>Hizmeti, üzerinde çalıştığı altyapıya zarar verecek biçimde otomatik/aşırı yükleme ile kullanmak,</li>
          <li>Platformu, üçüncü kişilere yeniden satmak veya izinsiz olarak devretmek.</li>
        </ul>
        <p>
          Müşterilere gönderilecek WhatsApp/SMS/e-posta bilgilendirmeleri için
          gerekli hukuki dayanağın (açık rıza dahil) alınmasından işletme
          sorumludur.
        </p>
      </LegalSection>

      <LegalSection n={6} title="Verilerin Mülkiyeti ve Veri Sorumlusu / İşleyen İlişkisi">
        <p>
          İşletmenin platforma girdiği veriler (müşteri, araç, iş emri, fotoğraf
          vb.) işletmeye aittir. Şirket, bu verileri yalnızca hizmeti sunmak için
          işler.
        </p>
        <p>
          İşletmenin kendi müşterilerine ait kişisel veriler bakımından{" "}
          <strong>veri sorumlusu işletmedir</strong>; {COMPANY.brand} bu veriler
          için <strong>veri işleyen</strong> sıfatıyla hareket eder. İşletmenin
          hesabına ilişkin veriler bakımından ise {COMPANY.brand} veri sorumlusu
          olabilir. Ayrıntılar{" "}
          <Link href="/kvkk">KVKK Aydınlatma Metni</Link>&apos;nde açıklanmıştır.
        </p>
      </LegalSection>

      <LegalSection n={7} title="Üçüncü Taraf Hizmetler">
        <p>
          Hizmetin sunulabilmesi için barındırma (hosting/sunucu), ödeme
          kuruluşu, SMS/WhatsApp operatörleri, e-posta gönderim servisi, OCR ve
          yapay zeka sağlayıcıları ile parça kataloğu gibi üçüncü taraf
          hizmetlerden yararlanılır.
        </p>
        <p>
          Bu üçüncü taraf hizmetlerinin kesintileri, gecikmeleri veya teslim
          sorunlarından {COMPANY.brand} doğrudan sorumlu tutulamaz. İlgili
          aktarımlar <Link href="/kvkk">KVKK Aydınlatma Metni</Link> ve{" "}
          <Link href="/acik-riza">Açık Rıza Metni</Link>&apos;nde açıklanmıştır.
        </p>
      </LegalSection>

      <LegalSection n={8} title="Bilgilendirme Mesajları">
        <p>
          Platform; hesap, işlem ve servis süreçlerine ilişkin operasyonel
          bilgilendirmeleri WhatsApp, SMS veya e-posta ile iletebilir. Servis
          sürecine ilişkin bilgilendirmeler, işletmenin talebi doğrultusunda son
          kullanıcılara gönderilebilir.
        </p>
        <p>
          Tanıtım/pazarlama amaçlı ileti gönderimi ancak ilgili kişinin açık
          rızası bulunması halinde yapılır.
        </p>
      </LegalSection>

      <LegalSection n={9} title="Yapay Zeka ve OCR Özellikleri">
        <p>
          Ruhsat/plaka okuma (OCR), araç eşleştirme ve yapay zeka destekli öneri
          özellikleri <strong>yardımcı teknoloji</strong> niteliğindedir. Bu
          özelliklerin ürettiği sonuçların doğruluğu garanti edilmez ve
          kullanıcının kontrolü olmaksızın nihai karar niteliği taşımaz.
        </p>
        <p>
          Kullanıcı, otomatik okunan/önerilen bilgileri kaydetmeden önce
          doğrulamakla yükümlüdür. Yanlış veya eksik bilgiden doğabilecek
          sonuçlardan Şirket sorumlu değildir.
        </p>
      </LegalSection>

      <LegalSection n={10} title="Fikri Mülkiyet Hakları">
        <p>
          Platformun yazılımı, kaynak kodu, tasarımı, {COMPANY.brand} markası,
          logosu ve tüm içeriğine ilişkin fikri ve sınai mülkiyet hakları{" "}
          {COMPANY.legalName}&apos;e aittir. Kullanıcıya yalnızca, abonelik süresi
          boyunca hizmeti kullanma hakkı tanınan, münhasır olmayan ve devredilemez
          bir kullanım lisansı verilir.
        </p>
      </LegalSection>

      <LegalSection n={11} title="Hizmet Sürekliliği ve Sorumluluğun Sınırlandırılması">
        <p>
          Şirket, hizmetin kesintisiz ve hatasız sunulacağını taahhüt etmez.
          Planlı bakım, güncelleme, altyapı sağlayıcı kaynaklı sorunlar veya
          internet kesintileri nedeniyle geçici erişim kesintileri yaşanabilir.
        </p>
        <p>
          Yürürlükteki mevzuatın izin verdiği azami ölçüde; Şirket, dolaylı
          zararlardan, kâr kaybından, veri kaybından veya üçüncü taraf hizmet
          kaynaklı zararlardan sorumlu değildir. Şirketin kasıt ve ağır ihmali
          saklıdır.
        </p>
      </LegalSection>

      <LegalSection n={12} title="Sözleşmenin Süresi, Feshi ve Verilerin Silinmesi">
        <p>
          Sözleşme, hesap açıldığı anda yürürlüğe girer ve hesap aktif olduğu
          sürece geçerlidir. Kullanıcı, aboneliğini/hesabını dilediği zaman
          sonlandırabilir.
        </p>
        <p>
          Hesabın sonlandırılması halinde işletme verileri, yasal saklama
          yükümlülükleri saklı kalmak kaydıyla makul bir süre içinde silinir, yok
          edilir veya anonim hale getirilir. Fatura/muhasebe kayıtları gibi
          mevzuat gereği saklanması zorunlu veriler ilgili süreler boyunca
          tutulabilir.
        </p>
      </LegalSection>

      <LegalSection n={13} title="Mücbir Sebep">
        <p>
          Doğal afet, yangın, salgın, siber saldırı, altyapı ve enerji
          kesintileri, kamu otoritesi kararları gibi tarafların kontrolü dışındaki
          durumlarda edimlerin yerine getirilememesi mücbir sebep sayılır ve bu
          süre boyunca tarafların yükümlülükleri askıya alınır.
        </p>
      </LegalSection>

      <LegalSection n={14} title="Kişisel Verilerin Korunması">
        <p>
          Kişisel verilerin işlenmesine ilişkin esaslar{" "}
          <Link href="/kvkk">KVKK Aydınlatma Metni</Link> ve{" "}
          <Link href="/acik-riza">Açık Rıza Metni</Link>&apos;nde;
          çerez kullanımı ise{" "}
          <Link href="/privacy">Gizlilik ve Çerez Politikası</Link>&apos;nda
          düzenlenmiştir. Bu belgeler işbu Sözleşme&apos;nin ayrılmaz
          parçasıdır.
        </p>
      </LegalSection>

      <LegalSection n={15} title="Değişiklikler">
        <p>
          Şirket, bu Sözleşme&apos;yi yürürlükteki mevzuat veya hizmet
          kapsamındaki değişikliklere göre güncelleyebilir. Güncel metin bu
          sayfada yayımlanır; önemli değişikliklerde Kullanıcı uygun bir kanalla
          bilgilendirilir. Güncellemeden sonra hizmetin kullanılmaya devam
          edilmesi, yeni koşulların kabulü anlamına gelir.
        </p>
      </LegalSection>

      <LegalSection n={16} title="Uygulanacak Hukuk ve Yetkili Mahkeme">
        <p>
          İşbu Sözleşme&apos;nin yorumunda ve uygulanmasında Türkiye Cumhuriyeti
          hukuku geçerlidir. Uyuşmazlıklarda İstanbul Anadolu Mahkemeleri ve İcra
          Daireleri yetkilidir. Tüketici sıfatını haiz kullanıcılar bakımından
          Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri&apos;nin yetkisi
          saklıdır.
        </p>
      </LegalSection>

      <LegalSection n={17} title="İletişim">
        <p>
          Sözleşme ile ilgili sorularınız için{" "}
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> adresine
          yazabilirsiniz.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
