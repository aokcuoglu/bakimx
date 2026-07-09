import Link from "next/link";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Footer } from "@/components/sections/Footer";

/**
 * BakımX hukuki metinlerinde geçen tüzel kişi / veri sorumlusu bilgileri.
 *
 * NOT: Köşeli parantezli alanlar ([...]) gerçek ticaret sicil bilgileriyle
 * doldurulmalıdır. Tek yerden güncellenince tüm hukuki sayfalara yansır.
 */
export const COMPANY = {
  /** İşletmeyi yürüten tüzel kişinin tam ticaret unvanı. */
  legalName: "Ergül Enerji San. Tic. Ltd. Şti.",
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
  { slug: "privacy", href: "/privacy", title: "Gizlilik ve Çerez Politikası" },
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

export function LegalPage({
  slug,
  title,
  intro,
  lastUpdated = LEGAL_LAST_UPDATED,
  children,
}: LegalPageProps) {
  const related = LEGAL_DOCS.filter((doc) => doc.slug !== slug);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="BakımX ana sayfa"
            className="inline-flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <BrandLogo variant="primary-light" size="lg" alt="BakımX" />
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Ana sayfaya dön
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>
          {intro ? (
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {intro}
            </p>
          ) : null}
          <p className="mt-3 text-sm text-muted-foreground">
            Son güncelleme: {lastUpdated}
          </p>

          {/*
            Bölümler düz <p>, <ul>/<li>, <strong>, <h3> ile yazılabilsin diye
            tipografi tek yerden (arbitrary variant'larla) veriliyor.
          */}
          <div
            className={[
              "mt-10 space-y-10",
              "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground",
              "[&_h3]:pt-1 [&_h3]:font-medium [&_h3]:text-foreground",
              "[&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-muted-foreground",
              "[&_li]:text-[15px] [&_li]:leading-relaxed [&_li]:text-muted-foreground",
              "[&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5",
              "[&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5",
              "[&_strong]:font-medium [&_strong]:text-foreground",
              "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:no-underline",
            ].join(" ")}
          >
            {children}
          </div>

          <nav className="mt-14 border-t pt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              İlgili belgeler
            </h2>
            <ul className="mt-3 space-y-2">
              {related.map((doc) => (
                <li key={doc.slug}>
                  <Link
                    href={doc.href}
                    className="text-sm text-primary underline underline-offset-2 hover:no-underline"
                  >
                    {doc.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </main>

      <Footer />
    </div>
  );
}

/** Numaralı hukuki bölüm — başlık + içerik. */
export function LegalSection({
  n,
  title,
  children,
}: {
  n?: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2>{n != null ? `${n}. ${title}` : title}</h2>
      {children}
    </section>
  );
}
