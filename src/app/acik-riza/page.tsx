import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY, LegalPage, LegalSection } from "@/components/legal/legal-page";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  path: "/acik-riza",
  title: "Açık Rıza Metni",
  description: "BakımX kişisel verilerin işlenmesi ve aktarımına ilişkin KVKK açık rıza metni.",
});

export default function AcikRizaPage() {
  return (
    <LegalPage
      slug="acik-riza"
      title="Açık Rıza Metni"
      intro={
        <>
          Bu Açık Rıza Metni, 6698 sayılı KVKK kapsamında{" "}
          <Link href="/kvkk">Aydınlatma Metni</Link> ile bilgilendirildikten
          sonra, açık rıza gerektiren belirli işleme faaliyetleri için verilecek
          rızaya ilişkindir. Açık rıza, hizmetin kullanımı için zorunlu olmayan
          faaliyetler bakımından tamamen isteğe bağlıdır.
        </>
      }
    >
      <LegalSection title="1. Açık Rıza Kapsamındaki İşleme Faaliyetleri">
        <p>
          {COMPANY.legalName} tarafından sunulan {COMPANY.brand} platformunda,
          aşağıdaki faaliyetler için — hukuki dayanağın yalnızca açık rıza olduğu
          hallerde — kişisel verilerimin işlenmesine açık rıza veriyorum:
        </p>
        <ul>
          <li>
            Hesap ve yetkili kullanıcı bilgilerimin (ad, soyad, firma unvanı,
            iletişim ve hesap bilgileri) üyelik yönetimi ve hizmet sunumu için
            işlenmesi,
          </li>
          <li>
            Platforma girdiğim müşteri, araç ve iş emri kayıtlarının hizmetin
            sunulması amacıyla işlenmesi,
          </li>
          <li>
            Ruhsat/plaka görüntülerinin OCR ve yapay zeka destekli özelliklerle
            işlenmesi ve bu amaçla ilgili sağlayıcılara aktarılması.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Yurt Dışına Aktarıma İlişkin Açık Rıza">
        <p>
          OCR, yapay zeka ve bazı altyapı hizmetlerinin sunucuları yurt dışında
          bulunabilir. Bu kapsamda, ilgili görüntü ve verilerimin{" "}
          <strong>hizmetin gereği olarak yurt dışındaki sağlayıcılara
          aktarılmasına</strong> ve orada işlenmesine, KVKK m.9 uyarınca açık rıza
          veriyorum.
        </p>
      </LegalSection>

      <LegalSection title="3. Üçüncü Taraflara Aktarıma İlişkin Açık Rıza">
        <p>
          Verilerimin, hizmetin sunulması amacıyla ve amaçla sınırlı olarak;
          barındırma sağlayıcıları, lisanslı ödeme kuruluşu, SMS/WhatsApp ve
          e-posta gönderim servisleri, OCR ve yapay zeka sağlayıcıları ile parça
          kataloğu sağlayıcılarına aktarılmasına açık rıza veriyorum.
        </p>
      </LegalSection>

      <LegalSection title="4. Ticari Elektronik İleti (Pazarlama) Rızası">
        <p>
          {COMPANY.brand} tarafından; kampanya, yenilik, tanıtım ve pazarlama
          amaçlı ticari elektronik iletilerin (SMS, e-posta, arama) tarafıma
          gönderilmesine ve bu amaçla iletişim bilgilerimin işlenmesine rıza
          veriyorum.
        </p>
        <p>
          <strong>Not:</strong> Bu rıza isteğe bağlıdır ve verilmemesi hizmetin
          kullanımını etkilemez. Servis ve hesap süreçlerine ilişkin zorunlu
          operasyonel bilgilendirmeler bu kapsamda değildir.
        </p>
      </LegalSection>

      <LegalSection title="5. Rızanın Geri Alınması">
        <p>
          Verdiğim açık rızayı dilediğim zaman{" "}
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> adresine
          bildirerek geri alabilirim. Ticari elektronik ileti gönderimini, iletide
          yer alan ret imkânı üzerinden de durdurabilirim. Rızanın geri alınması,
          geri alma tarihine kadar yürütülen hukuka uygun işlemleri etkilemez.
        </p>
      </LegalSection>

      <LegalSection title="6. Onay">
        <p>
          İşbu Açık Rıza Metni&apos;ni ve <Link href="/kvkk">Aydınlatma
          Metni</Link>&apos;ni okuduğumu, yukarıda belirtilen işleme ve aktarım
          faaliyetlerine <strong>özgür irademle, bilgilendirilmiş ve açık şekilde
          rıza</strong> verdiğimi kabul ve beyan ederim.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
