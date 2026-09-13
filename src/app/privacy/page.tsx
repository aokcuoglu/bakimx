import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY, LegalPage, LegalSection } from "@/components/legal/legal-page";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  path: "/privacy",
  title: "Gizlilik Politikası",
  description:
    "BakımX gizlilik ve çerez politikası; hangi verilerin nasıl toplandığı ve kullanıldığı.",
});

export default function PrivacyPage() {
  return (
    <LegalPage
      slug="privacy"
      title="Gizlilik Politikası"
      intro={
        <>
          Bu politika, {COMPANY.brand} web sitesi ve uygulamasını kullanırken
          verilerinizin nasıl toplandığını, kullanıldığını ve çerezlerle nasıl
          işlem yapıldığını açıklar. Kişisel verilerin işlenmesine ilişkin
          detaylar <Link href="/kvkk">KVKK Aydınlatma Metni</Link>&apos;nde yer
          alır.
        </>
      }
    >
      <LegalSection title="Genel">
        <p>
          {COMPANY.legalName} olarak gizliliğinize önem veriyoruz. Yalnızca
          hizmeti sunmak, güvenliği sağlamak ve deneyimi iyileştirmek için
          gerekli olan verileri işleriz.
        </p>
      </LegalSection>

      <LegalSection title="Topladığımız veriler">
        <p>
          Hizmeti sunarken ve siteyi ziyaret ettiğinizde şu tür bilgiler
          toplanabilir:
        </p>
        <ul>
          <li>
            <strong>Site ziyaretçisi:</strong> demo veya iletişim formu
            aracılığıyla paylaştığınız ad, telefon, işletme adı, şehir gibi
            bilgiler yalnızca size ulaşmak amacıyla kullanılır.
          </li>
          <li>
            <strong>Hesap sahibi:</strong> kayıt sırasında verilen ad, e-posta
            ve işletme bilgileri ile hizmeti kullanırken oluşan işlem kayıtları.
          </li>
          <li>
            <strong>Teknik:</strong> güvenlik ve hata giderme için IP adresi,
            tarayıcı türü ve sistem log kayıtları.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Çerezler" id="cerezler">
        <p>
          {COMPANY.brand} web sitesinde çerez ve benzeri teknolojiler kullanır.
          Tercihlerinizi sayfadaki çerez bildirimi veya footer&apos;daki{" "}
          <strong>Çerez tercihleri</strong> bağlantısından yönetebilirsiniz.
        </p>
        <ul>
          <li>
            <strong>Zorunlu çerezler:</strong> oturum, güvenlik ve temel site
            işlevleri için gereklidir; bunlar olmadan platform çalışmaz. Rıza
            gerektirmez.
          </li>
          <li>
            <strong>Performans çerezleri:</strong> site kullanımını ölçmek ve
            deneyimi iyileştirmek için kullanılır (örneğin Google Analytics).
            Yalnızca açık rızanızla yüklenir.
          </li>
          <li>
            <strong>İşlevsel çerezler:</strong> arayüz tercihlerinizi ve yardımcı
            özelliklerin durumunu hatırlamak için kullanılır. Açık rızanızla
            etkinleşir.
          </li>
          <li>
            <strong>Hedefleme çerezleri:</strong> ilgi alanlarınıza göre içerik
            veya reklam göstermek için kullanılabilir. Şu an aktif bir hedefleme
            aracı yoktur; ileride eklenirse yine açık rızanıza bağlı olacaktır.
          </li>
        </ul>
        <p>
          Çerezleri tarayıcı ayarlarınızdan silebilir veya engelleyebilirsiniz;
          ancak zorunlu çerezler engellenirse platform düzgün çalışmayabilir.
        </p>
      </LegalSection>

      <LegalSection title="Verilerin paylaşımı">
        <p>
          Kişisel verileriniz pazarlama amacıyla üçüncü taraflara satılmaz.
          Veriler yalnızca hizmetin sunulması için gerekli sağlayıcılarla
          (barındırma, ödeme, mesajlaşma, OCR/yapay zeka vb.) ve yasal
          yükümlülükler çerçevesinde yetkili kurumlarla paylaşılır. Ayrıntılar{" "}
          <Link href="/kvkk">KVKK Aydınlatma Metni</Link>&apos;nde açıklanmıştır.
        </p>
      </LegalSection>

      <LegalSection title="Haklarınız">
        <p>
          KVKK m.11 kapsamındaki haklarınızı ve bunları nasıl kullanacağınızı{" "}
          <Link href="/kvkk">KVKK Aydınlatma Metni</Link>&apos;nde
          bulabilirsiniz. Açık rıza gerektiren işlemler için{" "}
          <Link href="/acik-riza">Açık Rıza Metni</Link>&apos;ne bakabilirsiniz.
        </p>
      </LegalSection>

      <LegalSection title="İletişim">
        <p>
          Gizlilik ve çerez uygulamalarımıza ilişkin sorularınız için{" "}
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> adresine
          yazabilirsiniz.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
