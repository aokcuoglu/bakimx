import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY, LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Gizlilik ve Çerez Politikası",
  description:
    "BakımX gizlilik ve çerez (cookie) politikası; hangi verilerin nasıl toplandığı ve kullanıldığı.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      slug="privacy"
      title="Gizlilik ve Çerez Politikası"
      intro={
        <>
          Bu politika, {COMPANY.brand} web sitesi ve uygulamasını kullanırken
          verilerinizin nasıl toplandığını, kullanıldığını ve çerezlerle nasıl
          işlem yapıldığını açıklar. Kişisel verilerin işlenmesine ilişkin detaylar{" "}
          <Link href="/kvkk">KVKK Aydınlatma Metni</Link>&apos;nde yer alır.
        </>
      }
    >
      <LegalSection n={1} title="Genel">
        <p>
          {COMPANY.legalName} olarak gizliliğinize önem veriyoruz. Yalnızca hizmeti
          sunmak, güvenliği sağlamak ve deneyimi iyileştirmek için gerekli olan
          verileri işleriz.
        </p>
      </LegalSection>

      <LegalSection n={2} title="Topladığımız Veriler">
        <ul>
          <li>
            <strong>Site ziyaretçisi:</strong> demo/iletişim formu aracılığıyla
            paylaştığınız ad, telefon, işletme adı, şehir gibi bilgiler yalnızca
            size ulaşmak amacıyla kullanılır.
          </li>
          <li>
            <strong>Hesap sahibi:</strong> kayıt sırasında verilen ad, e-posta ve
            işletme bilgileri ile hizmeti kullanırken oluşan işlem kayıtları.
          </li>
          <li>
            <strong>Teknik:</strong> güvenlik ve hata giderme için IP adresi,
            tarayıcı türü ve sistem log kayıtları.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={3} title="Çerezler (Cookies)">
        <p>
          {COMPANY.brand}, çalışması için gerekli olan sınırlı sayıda çerez
          kullanır:
        </p>
        <ul>
          <li>
            <strong>Zorunlu çerezler:</strong> oturum açma ve güvenlik (kimlik
            doğrulama) için gereklidir; bunlar olmadan platforma giriş yapılamaz.
          </li>
          <li>
            <strong>İşlevsel çerezler:</strong> arayüz tercihlerinizi (örneğin
            kenar çubuğu durumu) hatırlamak için kullanılır.
          </li>
        </ul>
        <p>
          Çerezleri tarayıcı ayarlarınızdan silebilir veya engelleyebilirsiniz;
          ancak zorunlu çerezler engellenirse platform düzgün çalışmayabilir.
        </p>
      </LegalSection>

      <LegalSection n={4} title="Verilerin Paylaşımı">
        <p>
          Kişisel verileriniz pazarlama amacıyla üçüncü taraflara satılmaz. Veriler
          yalnızca hizmetin sunulması için gerekli sağlayıcılarla (barındırma,
          ödeme, mesajlaşma, OCR/yapay zeka vb.) ve yasal yükümlülükler
          çerçevesinde yetkili kurumlarla paylaşılır. Ayrıntılar{" "}
          <Link href="/kvkk">KVKK Aydınlatma Metni</Link>&apos;nde açıklanmıştır.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Haklarınız">
        <p>
          KVKK m.11 kapsamındaki haklarınızı ve bunları nasıl kullanacağınızı{" "}
          <Link href="/kvkk">KVKK Aydınlatma Metni</Link>&apos;nde bulabilirsiniz.
          Açık rıza gerektiren işlemler için{" "}
          <Link href="/acik-riza">Açık Rıza Metni</Link>&apos;ne bakabilirsiniz.
        </p>
      </LegalSection>

      <LegalSection n={6} title="İletişim">
        <p>
          Gizlilik ve çerez uygulamalarımıza ilişkin sorularınız için{" "}
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> adresine
          yazabilirsiniz.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
