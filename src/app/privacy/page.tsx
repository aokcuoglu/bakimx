import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gizlilik Politikası",
  description: "BakimX gizlilik politikası sayfası.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-8">
            Gizlilik Politikası
          </h1>
          <div className="space-y-6 text-muted-foreground">
            <p className="text-base leading-relaxed">
              Bu sayfa, BakimX gizlilik politikasını içermektedir. Şu anda bu
              sayfa bir yer tutucu olarak sunulmaktadır.
            </p>
            <p className="text-base leading-relaxed">
              BakimX, kullanıcı kişisel verilerini 6698 sayılı Kişisel Verilerin
              Korunması Kanunu (KVKK) kapsamında işlemektedir.
            </p>
            <h2 className="text-xl font-semibold text-foreground pt-4">
              Veri Toplama
            </h2>
            <p className="text-base leading-relaxed">
              Demo talep formu aracılığıyla paylaştığınız ad, telefon, işletme
              adı, şehir ve diğer bilgiler yalnızca size ulaşmak amacıyla
              kullanılmaktadır.
            </p>
            <h2 className="text-xl font-semibold text-foreground pt-4">
              Veri Paylaşımı
            </h2>
            <p className="text-base leading-relaxed">
              Kişisel verileriniz üçüncü taraflarla paylaşılmaz, satılmaz veya
              aktarılmaz.
            </p>
            <h2 className="text-xl font-semibold text-foreground pt-4">
              İletişim
            </h2>
            <p className="text-base leading-relaxed">
              Gizlilik politikası ile ilgili sorularınız için bizimle iletişime
              geçebilirsiniz.
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