import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  ClipboardList,
  History,
  PackageSearch,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/sections/Header"
import { Footer } from "@/components/sections/Footer"
import { JsonLd } from "@/components/seo/json-ld"
import {
  IS_EMRI_REHBER_BOUNDARY,
  IS_EMRI_REHBER_DESCRIPTION,
  IS_EMRI_REHBER_FAQS,
  IS_EMRI_REHBER_H1,
  IS_EMRI_REHBER_INTRO,
  IS_EMRI_REHBER_PATH,
  IS_EMRI_REHBER_TITLE,
  IS_EMRI_REHBER_UNSURLAR,
} from "@/lib/landing/oto-servis-is-emri-nasil-hazirlanir"
import { publicPageMetadata, SITE_URL } from "@/lib/seo"

export const metadata: Metadata = publicPageMetadata({
  path: IS_EMRI_REHBER_PATH,
  title: IS_EMRI_REHBER_TITLE,
  description: IS_EMRI_REHBER_DESCRIPTION,
})

const PUBLISHED_DATE = "2026-08-20"
const CONTENT_OWNER = "BakımX Ürün Ekibi"

const unsurIcons = [ClipboardList, PackageSearch, Wrench, Camera, BadgeCheck, History] as const

const articleStructuredData = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: IS_EMRI_REHBER_TITLE,
  description: IS_EMRI_REHBER_DESCRIPTION,
  url: `${SITE_URL}${IS_EMRI_REHBER_PATH}`,
  datePublished: PUBLISHED_DATE,
  dateModified: PUBLISHED_DATE,
  author: { "@type": "Organization", name: CONTENT_OWNER },
  publisher: { "@type": "Organization", name: "BakımX" },
}

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: IS_EMRI_REHBER_FAQS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
}

export default function IsEmriRehberPage() {
  return (
    <>
      <JsonLd data={[articleStructuredData, faqStructuredData]} />
      <Header />
      <main className="overflow-hidden">
        <section className="relative border-b bg-background">
          <div className="absolute inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b from-primary/10 to-transparent" />
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary-strong">
              Rehber · Eğitim
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{IS_EMRI_REHBER_H1}</h1>
            <p className="mt-6 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              {IS_EMRI_REHBER_INTRO}
            </p>
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Button asChild size="lg">
                <Link href="/is-emri-programi">
                  Dijital iş emrini gör
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <span className="text-sm text-muted-foreground">Örnek ekranla · Kurulum gerekmez</span>
            </div>
            <p className="mt-6 text-sm leading-6 text-muted-foreground">{IS_EMRI_REHBER_BOUNDARY}</p>
          </div>
        </section>

        <section className="border-b bg-muted/25 py-14 sm:py-16" aria-labelledby="ornek-baslik">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 id="ornek-baslik" className="sr-only">
              Örnek iş emri ekranı
            </h2>
            <figure className="overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-primary/10">
              <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3">
                <span className="font-mono text-xs font-medium text-muted-foreground">İŞ EMRİ · ÖRNEK EKRAN</span>
              </div>
              <Image
                src="/landing/screens/order-detail.png"
                alt="BakımX örnek iş emri detay ekranı, iş tanımı, parça ve işçilik kalemleriyle"
                width={1200}
                height={800}
                className="h-auto w-full"
                priority
              />
              <figcaption className="border-t px-4 py-3 text-xs leading-5 text-muted-foreground">
                Temsili verilerle gösterilen gerçek BakımX iş emri ekranı; iş tanımı, kalemler ve fotoğraf kanıtı aynı kayıtta toplanır.
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="bg-navy py-16 text-navy-foreground sm:py-20" aria-labelledby="unsurlar-baslik">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-navy-foreground/70">
                Uygulanabilir standart
              </p>
              <h2 id="unsurlar-baslik" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Eksiksiz bir iş emrinde altı unsur bulunur
              </h2>
              <p className="mt-4 text-base leading-7 text-navy-foreground/70">
                Her unsurun ne işe yaradığı ve BakımX&apos;te nasıl uygulandığı aşağıda ayrı ayrı gösteriliyor.
              </p>
            </div>
            <ol className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-navy-foreground/15 bg-navy-foreground/15 sm:grid-cols-2 lg:grid-cols-3">
              {IS_EMRI_REHBER_UNSURLAR.map((unsur, index) => {
                const Icon = unsurIcons[index]
                return (
                  <li key={unsur.title} className="relative bg-navy p-5 sm:p-6">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm text-navy-foreground/60">0{index + 1}</span>
                      <Icon className="size-5 text-navy-foreground/80" aria-hidden="true" />
                    </div>
                    <h3 className="mt-6 text-base font-semibold">{unsur.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-navy-foreground/65">{unsur.what}</p>
                    <p className="mt-3 text-sm font-medium leading-6 text-navy-foreground/85">Neden: {unsur.why}</p>
                    <p className="mt-3 text-xs leading-5 text-navy-foreground/55">BakımX&apos;te: {unsur.proof}</p>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>

        <section className="py-16 sm:py-24" aria-labelledby="baglanti-baslik">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl border bg-muted/35 p-6 sm:p-8">
              <h2 id="baglanti-baslik" className="text-xl font-semibold">
                İhtiyacınıza göre ayrıntıya inin
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                Bu standardın uygulamada nasıl çalıştığını ve araç kabulünün nasıl hazırlandığını ayrı sayfalarda inceleyin.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {[
                  { href: "/is-emri-programi", title: "İş emri programı", text: "Dijital iş emri kullanım senaryosunu ve ürün ekranını inceleyin." },
                  { href: "/oto-servis-programi", title: "Oto servis programı", text: "Araç kabulden teslimata bütün servis akışına genel bakış." },
                  { href: "/rehber/arac-kabul-formu", title: "Araç kabul formu rehberi", text: "Eksiksiz bir araç kabulünde olması gereken adımları öğrenin." },
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

        <section className="border-t bg-background py-16 sm:py-24" aria-labelledby="sss-baslik">
          <div className="mx-auto grid max-w-5xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.65fr_1.35fr] lg:px-8">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary-strong">Sık sorulanlar</p>
              <h2 id="sss-baslik" className="mt-3 text-3xl font-bold tracking-tight">
                İş emri hazırlama hakkında
              </h2>
            </div>
            <dl className="divide-y border-y">
              {IS_EMRI_REHBER_FAQS.map((item) => (
                <div key={item.question} className="py-6 first:pt-0 lg:first:pt-6">
                  <dt className="font-semibold text-foreground">{item.question}</dt>
                  <dd className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">{item.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="border-t bg-muted/25 py-10" aria-labelledby="kaynak-baslik">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <h2 id="kaynak-baslik" className="sr-only">
              İçerik sahibi ve kaynaklar
            </h2>
            <p className="text-xs leading-5 text-muted-foreground">
              Hazırlayan ve inceleyen: {CONTENT_OWNER} · Yayımlanma: 20 Ağustos 2026 · Son güncelleme: 20 Ağustos 2026
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Kaynak: BakımX iş emri, teklif, fotoğraf ve işlem geçmişi ekranları (uygulama içi, örnek veri ile gösterilmiştir).
            </p>
          </div>
        </section>

        <section className="bg-primary py-14 text-primary-foreground sm:py-16">
          <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-7 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Bu standardı kendi iş emirlerinizde görün</h2>
              <p className="mt-2 text-sm leading-6 text-primary-foreground sm:text-base">
                Altı unsurun BakımX&apos;te nasıl bir araya geldiğini ürün sayfasında inceleyin.
              </p>
            </div>
            <Button asChild size="lg" variant="secondary">
              <Link href="/is-emri-programi">
                Dijital iş emrini gör
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
