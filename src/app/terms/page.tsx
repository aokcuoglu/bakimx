import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kullanım Koşulları",
  description: "BakimX kullanım koşulları sayfası.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-8">
            Kullanım Koşulları
          </h1>
          <div className="space-y-6 text-muted-foreground">
            <p className="text-base leading-relaxed">
              Bu sayfa, BakimX kullanım koşullarını içermektedir. Şu anda bu
              sayfa bir yer tutucu olarak sunulmaktadır.
            </p>
            <h2 className="text-xl font-semibold text-foreground pt-4">
              Hizmet Tanımı
            </h2>
            <p className="text-base leading-relaxed">
              BakimX, oto servisler için dijital araç kabul ve müşteri onay
              platformudur. Hizmet şu anda demo aşamasındadır.
            </p>
            <h2 className="text-xl font-semibold text-foreground pt-4">
              Kullanıcı Sorumlulukları
            </h2>
            <p className="text-base leading-relaxed">
              Kullanıcılar, platforma girdikleri bilgilerin doğruluğundan
              sorumludur. İşletme bilgileri ve araç kabul verileri kullanıcıya
              aittir.
            </p>
            <h2 className="text-xl font-semibold text-foreground pt-4">
              Değişiklikler
            </h2>
            <p className="text-base leading-relaxed">
              BakimX, bu koşulları önceden bildirimde bulunmaksızın değiştirme
              hakkını saklı tutar.
            </p>
            <p className="text-sm text-muted-foreground mt-8">
              Son güncelleme: 2025
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}