import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PrintButton } from "@/components/shared/print-button"
import { Header } from "@/components/sections/Header"
import { Footer } from "@/components/sections/Footer"
import { JsonLd } from "@/components/seo/json-ld"
import {
  ARAC_KABUL_FORMU_BOUNDARY,
  ARAC_KABUL_FORMU_CHECKLIST,
  ARAC_KABUL_FORMU_CONTENT_OWNER,
  ARAC_KABUL_FORMU_DESCRIPTION,
  ARAC_KABUL_FORMU_FAQS,
  ARAC_KABUL_FORMU_H1,
  ARAC_KABUL_FORMU_INTRO,
  ARAC_KABUL_FORMU_PATH,
  ARAC_KABUL_FORMU_SOURCES,
  ARAC_KABUL_FORMU_TITLE,
} from "@/lib/landing/arac-kabul-formu"
import { publicPageMetadata, SITE_URL } from "@/lib/seo"

export const metadata: Metadata = publicPageMetadata({
  path: ARAC_KABUL_FORMU_PATH,
  title: ARAC_KABUL_FORMU_TITLE,
  description: ARAC_KABUL_FORMU_DESCRIPTION,
})

const PUBLISHED_LABEL = "20 Ağustos 2026"

const articleStructuredData = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: ARAC_KABUL_FORMU_TITLE,
  description: ARAC_KABUL_FORMU_DESCRIPTION,
  url: `${SITE_URL}${ARAC_KABUL_FORMU_PATH}`,
  datePublished: ARAC_KABUL_FORMU_CONTENT_OWNER.publishedAt,
  dateModified: ARAC_KABUL_FORMU_CONTENT_OWNER.updatedAt,
  author: { "@type": "Organization", name: ARAC_KABUL_FORMU_CONTENT_OWNER.role },
  publisher: { "@type": "Organization", name: "BakımX" },
}

const howToStructuredData = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: ARAC_KABUL_FORMU_H1,
  description: ARAC_KABUL_FORMU_DESCRIPTION,
  step: ARAC_KABUL_FORMU_CHECKLIST.map((item) => ({
    "@type": "HowToStep",
    name: item.title,
    text: item.description,
  })),
}

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: ARAC_KABUL_FORMU_FAQS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
}

export default function AracKabulFormuPage() {
  return (
    <>
      <JsonLd data={[articleStructuredData, howToStructuredData, faqStructuredData]} />
      <div className="print:hidden">
        <Header />
      </div>
      <main className="overflow-hidden">
        <section className="relative border-b bg-background print:hidden">
          <div className="absolute inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b from-primary/10 to-transparent" />
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary-strong">
              Rehber · Eğitim
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{ARAC_KABUL_FORMU_H1}</h1>
            <p className="mt-6 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              {ARAC_KABUL_FORMU_INTRO}
            </p>
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Button asChild size="lg">
                <Link href="/dijital-arac-kabul">
                  Dijital araç kabul akışını gör
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <span className="text-sm text-muted-foreground">Örnek ekranla · Kurulum gerekmez</span>
            </div>
            <p className="mt-6 text-sm leading-6 text-muted-foreground">{ARAC_KABUL_FORMU_BOUNDARY}</p>
          </div>
        </section>

        <section className="border-b bg-muted/25 py-14 sm:py-16 print:hidden" aria-labelledby="ornek-baslik">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 id="ornek-baslik" className="sr-only">
              Örnek dijital araç kabul ekranı
            </h2>
            <figure className="overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-primary/10">
              <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3">
                <span className="font-mono text-xs font-medium text-muted-foreground">ARAÇ KABUL · ÖRNEK EKRAN</span>
              </div>
              <Image
                src="/landing/screens/digital-intake-vehicle-info.png"
                alt="BakımX ruhsattan otomatik dolan araç ve kabul bilgileri ekranı"
                width={1000}
                height={1000}
                className="h-auto w-full"
                priority
              />
              <figcaption className="border-t px-4 py-3 text-xs leading-5 text-muted-foreground">
                Temsili verilerle gösterilen gerçek BakımX ürün ekranı; aşağıdaki kontrol listesi bu akıştaki alanlara karşılık gelir.
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="bg-navy py-16 text-navy-foreground sm:py-20 print:bg-white print:py-0 print:text-foreground" aria-labelledby="liste-baslik">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 print:max-w-none print:px-0">
            <div className="hidden print:block">
              <p className="text-lg font-semibold text-foreground">BakımX — Araç Kabul Kontrol Listesi</p>
              <p className="text-xs text-muted-foreground">bakimx.com{ARAC_KABUL_FORMU_PATH} · {PUBLISHED_LABEL}</p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden">
              <div className="max-w-3xl">
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-navy-foreground/70">
                  Sahada uygulayın
                </p>
                <h2 id="liste-baslik" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                  Eksiksiz bir araç kabulünde 8 adım
                </h2>
                <p className="mt-4 text-base leading-7 text-navy-foreground/70">
                  Yazdırıp elle işaretleyebilir ya da her adımı dijital araç kabul akışında tamamlayabilirsiniz.
                </p>
              </div>
              <PrintButton label="Listeyi yazdır" className="shrink-0 border-navy-foreground/30 bg-transparent text-navy-foreground hover:bg-navy-foreground/10 print:hidden" />
            </div>
            <ol className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-navy-foreground/15 bg-navy-foreground/15 sm:grid-cols-2 print:mt-4 print:grid-cols-1 print:gap-2 print:rounded-none print:border-0 print:bg-transparent">
              {ARAC_KABUL_FORMU_CHECKLIST.map((step, index) => (
                <li
                  key={step.title}
                  className="relative bg-navy p-5 sm:p-6 print:break-inside-avoid print:border print:border-border print:bg-white print:p-3"
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded border-2 border-navy-foreground/40 font-mono text-xs text-navy-foreground/70 print:border-foreground/50 print:text-foreground"
                    >
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-base font-semibold print:text-sm">{step.title}</h3>
                      <p className="mt-1.5 text-sm leading-6 text-navy-foreground/65 print:text-xs print:leading-5 print:text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="py-16 sm:py-24 print:hidden" aria-labelledby="baglanti-baslik">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl border bg-muted/35 p-6 sm:p-8">
              <h2 id="baglanti-baslik" className="text-xl font-semibold">
                İhtiyacınıza göre ayrıntıya inin
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                Kağıt form veya Excel&apos;den dijital araç kabule geçmek isterseniz akışı ve hasar kaydını ürün sayfalarında inceleyin.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {[
                  { href: "/dijital-arac-kabul", title: "Dijital araç kabul", text: "Ruhsat okuma, kabul fotoğrafları ve hasar kaydı akışını inceleyin." },
                  { href: "/dijital-arac-kabul#ekranlar-baslik", title: "Hasar kaydı ve fotoğraf kanıtı", text: "Hasarın araç şemasında nasıl işaretlendiğini gerçek ekranda görün." },
                  { href: "/oto-servis-programi", title: "Oto servis programı", text: "Araç kabulden teslimata bütün servis akışına genel bakış." },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex flex-col justify-between gap-4 rounded-xl border bg-background p-5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <span>
                      <span className="block font-semibold text-foreground">{item.title}</span>
                      <span className="mt-1 block text-sm leading-6 text-muted-foreground">{item.text}</span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t bg-background py-16 sm:py-24 print:hidden" aria-labelledby="sss-baslik">
          <div className="mx-auto grid max-w-5xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.65fr_1.35fr] lg:px-8">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary-strong">Sık sorulanlar</p>
              <h2 id="sss-baslik" className="mt-3 text-3xl font-bold tracking-tight">
                Araç kabul formu hakkında
              </h2>
            </div>
            <dl className="divide-y border-y">
              {ARAC_KABUL_FORMU_FAQS.map((item) => (
                <div key={item.question} className="py-6 first:pt-0 lg:first:pt-6">
                  <dt className="font-semibold text-foreground">{item.question}</dt>
                  <dd className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">{item.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="border-t bg-muted/25 py-10 print:hidden" aria-labelledby="kaynak-baslik">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <h2 id="kaynak-baslik" className="sr-only">
              İçerik sahibi ve kaynaklar
            </h2>
            <p className="text-xs leading-5 text-muted-foreground">
              Hazırlayan ve inceleyen: {ARAC_KABUL_FORMU_CONTENT_OWNER.role} · Yayımlanma: {PUBLISHED_LABEL} · Son güncelleme: {PUBLISHED_LABEL}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Kaynak:{" "}
              {ARAC_KABUL_FORMU_SOURCES.map((source, index) => (
                <span key={source.href}>
                  {index > 0 ? ", " : ""}
                  <Link href={source.href} className="underline underline-offset-2 hover:text-foreground">
                    {source.label}
                  </Link>
                </span>
              ))}
              .
            </p>
          </div>
        </section>

        <section className="bg-primary py-14 text-primary-foreground sm:py-16 print:hidden">
          <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-7 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Bu listeyi kendi kabul kayıtlarınızda görün</h2>
              <p className="mt-2 text-sm leading-6 text-primary-foreground sm:text-base">
                Adımların BakımX&apos;te nasıl bir araya geldiğini ürün sayfasında inceleyin.
              </p>
            </div>
            <Button asChild size="lg" variant="secondary">
              <Link href="/dijital-arac-kabul">
                Dijital araç kabul akışını gör
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <div className="print:hidden">
        <Footer />
      </div>
    </>
  )
}
