import { PublicSite } from "@/components/public/PublicSite";
import { Header } from "@/components/sections/Header";
import Link from "next/link";
import { Footer } from "@/components/sections/Footer";

/**
 * BakımX hukuki metinlerinde geçen tüzel kişi / veri sorumlusu bilgileri.
 *
 * NOT: Köşeli parantezli alanlar ([...]) gerçek ticaret sicil bilgileriyle
 * doldurulmalıdır. Tek yerden güncellenince tüm hukuki sayfalara yansır.
 */
export const COMPANY = {
  /** İşletmeyi yürüten tüzel kişinin tam ticaret unvanı. */
  legalName: "Ergül Enerji Sanayi ve Ticaret Limited Şirketi",
  /** Marka adı (rehbere göre her zaman "BakımX"). */
  brand: "BakımX",
  address:
    "Esentepe Mah. Kartal Oto Sanayi Sitesi C1 Blok No:25 Kartal / İstanbul / Türkiye",
  mersis: "0357042224900019",
  tradeRegistryNo: "64972-5",
  taxOffice: "Kartal Vergi Dairesi",
  taxNo: "3570422249",
  /** KVKK başvuru ve iletişim için birincil e-posta. */
  email: "hey@bakimx.com",
  /** Resmî/tebligata elverişli KEP adresi (formal KVKK başvurusu için). */
  kep: "ergulenerji@hs03.kep.tr",
  phone: "0216 387 00 78",
  website: "bakimx.com",
  app: "app.bakimx.com",
} as const;

/** Tüm hukuki metinler için ortak "son güncelleme" tarihi. */
export const LEGAL_LAST_UPDATED = "9 Temmuz 2026";

type LegalDoc = {
  slug: "terms" | "kvkk" | "acik-riza" | "privacy";
  href: string;
  title: string;
};

/** Sayfa altındaki "ilgili belgeler" navigasyonu için tek kaynak. */
export const LEGAL_DOCS: LegalDoc[] = [
  { slug: "terms", href: "/terms", title: "Kullanım Koşulları ve Hizmet Sözleşmesi" },
  { slug: "kvkk", href: "/kvkk", title: "KVKK Aydınlatma Metni" },
  { slug: "acik-riza", href: "/acik-riza", title: "Açık Rıza Metni" },
  { slug: "privacy", href: "/privacy", title: "Gizlilik Politikası" },
];

type LegalPageProps = {
  /** Aktif belge — ilgili belgeler listesinden çıkarılır. */
  slug: LegalDoc["slug"];
  title: string;
  /** Başlığın hemen altında gösterilecek kısa özet (opsiyonel). */
  intro?: React.ReactNode;
  lastUpdated?: string;
  children: React.ReactNode;
};

/**
 * Hukuki belge düzeni — Vercel/Linear açık yüzey + okuma odaklı tipografi.
 * Referans: sade başlık, hemen altında güncelleme tarihi, geniş satır aralığı.
 */
export function LegalPage({
  slug,
  title,
  intro,
  lastUpdated = LEGAL_LAST_UPDATED,
  children,
}: LegalPageProps) {
  const related = LEGAL_DOCS.filter((doc) => doc.slug !== slug);

  return (
    <PublicSite>
      <Header />

      <main className="flex-1 bg-background">
        <article className="mx-auto max-w-2xl px-5 pb-20 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8">
          <header className="space-y-3">
            <h1 className="text-[2rem] font-semibold leading-[1.15] tracking-tight text-foreground sm:text-4xl sm:leading-[1.1]">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">
              Son güncelleme: {lastUpdated}
            </p>
          </header>

          {intro ? (
            <p className="mt-8 text-[15px] leading-7 text-muted-foreground sm:text-base sm:leading-7">
              {intro}
            </p>
          ) : null}

          <div
            className={[
              "mt-12 space-y-12",
              "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground",
              "[&_h3]:pt-1 [&_h3]:text-[15px] [&_h3]:font-medium [&_h3]:text-foreground",
              "[&_p]:text-[15px] [&_p]:leading-7 [&_p]:text-muted-foreground",
              "[&_li]:text-[15px] [&_li]:leading-7 [&_li]:text-muted-foreground",
              "[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5",
              "[&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5",
              "[&_strong]:font-medium [&_strong]:text-foreground",
              "[&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary",
            ].join(" ")}
          >
            {children}
          </div>

          <nav
            aria-label="İlgili belgeler"
            className="mt-16 border-t border-border pt-8"
          >
            <p className="text-sm text-muted-foreground">İlgili belgeler</p>
            <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
              {related.map((doc) => (
                <li key={doc.slug}>
                  <Link
                    href={doc.href}
                    className="text-sm text-foreground underline underline-offset-2 hover:text-primary"
                  >
                    {doc.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </article>
      </main>

      <Footer />
    </PublicSite>
  );
}

/** Hukuki bölüm — başlık + içerik. `n` verilirse numaralı başlık üretir. */
export function LegalSection({
  n,
  title,
  children,
  id,
}: {
  n?: number;
  title: string;
  children: React.ReactNode;
  /** Sayfa içi çapa (ör. çerez politikası bağlantısı). */
  id?: string;
}) {
  return (
    <section id={id} className="space-y-3 scroll-mt-24">
      <h2>{n != null ? `${n}. ${title}` : title}</h2>
      {children}
    </section>
  );
}
