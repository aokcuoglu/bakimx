import type { Metadata } from "next";
import Link from "next/link";
import { COMPANY, LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni",
  description:
    "BakımX kişisel verilerin korunması ve işlenmesine ilişkin aydınlatma metni (6698 sayılı KVKK).",
};

export default function KvkkPage() {
  return (
    <LegalPage
      slug="kvkk"
      title="KVKK Aydınlatma Metni"
      intro={
        <>
          Bu Aydınlatma Metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu
          (&quot;KVKK&quot;) kapsamında, {COMPANY.brand} platformu aracılığıyla
          işlenen kişisel verilere ilişkin olarak {COMPANY.legalName} tarafından
          hazırlanmıştır.
        </>
      }
    >
      <LegalSection n={1} title="Veri Sorumlusu">
        <p>
          Veri sorumlusu, {COMPANY.legalName}&apos;dir.
        </p>
        <ul>
          <li>Adres: {COMPANY.address}</li>
          <li>MERSİS No: {COMPANY.mersis}</li>
          <li>Ticaret Sicil No: {COMPANY.tradeRegistryNo}</li>
          <li>Vergi Dairesi / No: {COMPANY.taxOffice} / {COMPANY.taxNo}</li>
          <li>
            E-posta: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={2} title="Veri Sorumlusu / Veri İşleyen Rolü">
        <p>
          {COMPANY.brand} bir bulut yazılım (SaaS) hizmetidir. Platformu kullanan
          işletmenin kendi müşterilerine ve araçlarına ait kişisel veriler
          bakımından <strong>veri sorumlusu ilgili işletmedir</strong>;{" "}
          {COMPANY.brand}, bu veriler için işletme adına{" "}
          <strong>veri işleyen</strong> sıfatıyla hareket eder.
        </p>
        <p>
          Buna karşılık, işletmenin hesabına, yetkili kullanıcısına ve platformun
          işleyişine ilişkin verilerde {COMPANY.brand}{" "}
          <strong>veri sorumlusu</strong> olarak hareket eder. Bu metin, her iki
          durumda da uygulanan esasları açıklar.
        </p>
      </LegalSection>

      <LegalSection n={3} title="İşlenen Kişisel Veri Kategorileri">
        <p>Hizmetin niteliğine bağlı olarak aşağıdaki veri kategorileri işlenebilir:</p>
        <ul>
          <li>
            <strong>Kimlik:</strong> ad, soyad; işletme müşterisi için gerektiğinde
            T.C. kimlik/vergi numarası.
          </li>
          <li>
            <strong>İletişim:</strong> telefon, e-posta, adres/şehir.
          </li>
          <li>
            <strong>Müşteri ve İşlem:</strong> işletmenin girdiği müşteri kayıtları,
            iş emirleri, servis notları, onay/imza kayıtları.
          </li>
          <li>
            <strong>Araç:</strong> plaka, ruhsat bilgileri, şasi/VIN, marka-model,
            kilometre ve teknik veriler.
          </li>
          <li>
            <strong>Görsel:</strong> araç kabul/servis sürecinde çekilen fotoğraflar,
            hasar işaretlemeleri, ruhsat görüntüleri.
          </li>
          <li>
            <strong>Finansal:</strong> fatura/ödeme bilgileri, abonelik kayıtları
            (kart bilgileri Şirket tarafından saklanmaz; lisanslı ödeme kuruluşunca
            işlenir).
          </li>
          <li>
            <strong>İşlem Güvenliği:</strong> kullanıcı işlem kayıtları, IP adresi,
            sistem ve güvenlik logları.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={4} title="Kişisel Verilerin İşlenme Amaçları">
        <p>Kişisel veriler aşağıdaki amaçlarla işlenir:</p>
        <ul>
          <li>Hizmetin sunulması, hesap ve üyelik yönetimi,</li>
          <li>Araç kabul, iş emri, servis ve teslim süreçlerinin yürütülmesi,</li>
          <li>Müşteriye servis bilgilendirmesi ve onay süreçleri (işletme talebiyle),</li>
          <li>Faturalama, tahsilat ve abonelik yönetimi,</li>
          <li>Teknik destek, hata giderme ve hizmet kalitesinin iyileştirilmesi,</li>
          <li>Bilgi güvenliğinin sağlanması ve kötüye kullanımın önlenmesi,</li>
          <li>Yasal yükümlülüklerin yerine getirilmesi ve yetkili kurumlara yanıt verilmesi.</li>
        </ul>
      </LegalSection>

      <LegalSection n={5} title="İşlemenin Hukuki Sebepleri">
        <p>
          Kişisel veriler, KVKK m.5 ve m.6&apos;da öngörülen aşağıdaki hukuki
          sebeplere dayanılarak işlenir:
        </p>
        <ul>
          <li>Bir sözleşmenin kurulması veya ifası için gerekli olması,</li>
          <li>Şirketin hukuki yükümlülüğünü yerine getirmesi,</li>
          <li>Bir hakkın tesisi, kullanılması veya korunması için zorunlu olması,</li>
          <li>
            İlgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla,
            Şirketin meşru menfaatleri için zorunlu olması,
          </li>
          <li>
            Yukarıdaki sebeplerin bulunmadığı hallerde ilgili kişinin{" "}
            <strong>açık rızasının</strong> bulunması.
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={6} title="Kişisel Verilerin Toplanma Yöntemi">
        <p>
          Kişisel veriler; kayıt formları, platforma yapılan veri girişleri,
          fotoğraf/görüntü yükleme, ruhsat/plaka OCR işlemleri, ödeme akışı ve
          platform kullanımı sırasında oluşan log kayıtları aracılığıyla
          elektronik ortamda toplanır.
        </p>
      </LegalSection>

      <LegalSection n={7} title="Kişisel Verilerin Aktarılması">
        <p>
          Kişisel veriler, işleme amaçlarıyla sınırlı olarak ve KVKK m.8-9&apos;a
          uygun şekilde aşağıdaki alıcı gruplarına aktarılabilir:
        </p>
        <ul>
          <li>Sunucu/barındırma ve altyapı hizmeti sağlayıcıları,</li>
          <li>Lisanslı ödeme kuruluşu / banka (fatura ve tahsilat için),</li>
          <li>SMS/WhatsApp ve e-posta gönderim servisleri (bilgilendirme için),</li>
          <li>OCR ve yapay zeka hizmeti sağlayıcıları (görüntüden metin okuma ve öneri için),</li>
          <li>Parça kataloğu / teknik veri sağlayıcıları,</li>
          <li>Yasal olarak yetkili kamu kurum ve kuruluşları (talep halinde).</li>
        </ul>
        <h3>Yurt Dışına Aktarım</h3>
        <p>
          OCR ve yapay zeka gibi bazı hizmetler, sunucuları yurt dışında bulunan
          sağlayıcılar üzerinden çalışabilir. Bu durumda ilgili görüntü/metin
          verileri, hizmetin gereği olarak yurt dışına aktarılabilir. Yurt dışına
          aktarım, KVKK m.9&apos;da öngörülen şartlara ve gerekli olduğu hallerde{" "}
          <Link href="/acik-riza">açık rızanıza</Link> dayanılarak yapılır.
        </p>
      </LegalSection>

      <LegalSection n={8} title="Saklama Süreleri">
        <p>
          Kişisel veriler, işlendikleri amaç için gerekli olan süre ve ilgili
          mevzuatta öngörülen yasal saklama süreleri boyunca saklanır. Amaç ortadan
          kalktığında ve yasal süreler dolduğunda veriler silinir, yok edilir veya
          anonim hale getirilir.
        </p>
      </LegalSection>

      <LegalSection n={9} title="İlgili Kişinin Hakları (KVKK m.11)">
        <p>KVKK m.11 uyarınca ilgili kişi olarak;</p>
        <ul>
          <li>Kişisel verinizin işlenip işlenmediğini öğrenme,</li>
          <li>İşlenmişse buna ilişkin bilgi talep etme,</li>
          <li>İşlenme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme,</li>
          <li>Yurt içinde/dışında aktarıldığı üçüncü kişileri bilme,</li>
          <li>Eksik/yanlış işlenmişse düzeltilmesini isteme,</li>
          <li>Şartları oluştuğunda silinmesini/yok edilmesini isteme,</li>
          <li>Düzeltme/silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme,</li>
          <li>Otomatik sistemlerle analiz sonucu aleyhinize bir sonuç çıkmasına itiraz etme,</li>
          <li>Kanuna aykırı işleme nedeniyle zararınızın giderilmesini talep etme</li>
        </ul>
        <p>haklarına sahipsiniz.</p>
      </LegalSection>

      <LegalSection n={10} title="Başvuru Yöntemi">
        <p>
          Haklarınıza ilişkin taleplerinizi{" "}
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> adresine veya
          resmî/tebligata elverişli KEP adresimize (
          <strong>{COMPANY.kep}</strong>) iletebilirsiniz. Başvurular, KVKK ve
          ilgili mevzuatta öngörülen sürede (kural olarak en geç 30 gün içinde)
          sonuçlandırılır.
        </p>
        <p>
          İşletmenin kendi müşterilerine ait verilerle ilgili talepler,{" "}
          <strong>veri sorumlusu sıfatını taşıyan ilgili işletmeye</strong>{" "}
          yöneltilmelidir; {COMPANY.brand} bu tür talepleri işletmeye yönlendirir.
        </p>
      </LegalSection>

      <LegalSection n={11} title="Güncellemeler">
        <p>
          Bu Aydınlatma Metni, mevzuat veya hizmet süreçlerindeki değişikliklere
          göre güncellenebilir. Güncel metin bu sayfada yayımlanır.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
