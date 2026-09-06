import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  ClipboardList,
  PackageSearch,
  Smartphone,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/sections/Header"
import { Footer } from "@/components/sections/Footer"
import { JsonLd } from "@/components/seo/json-ld"
import {
  OTO_SERVIS_PROGRAMI_DESCRIPTION,
  OTO_SERVIS_PROGRAMI_FAQS,
  OTO_SERVIS_PROGRAMI_H1,
  OTO_SERVIS_PROGRAMI_INTRO,
  OTO_SERVIS_PROGRAMI_PATH,
  OTO_SERVIS_PROGRAMI_TITLE,
} from "@/lib/landing/oto-servis-programi"
import { publicPageMetadata, SITE_URL } from "@/lib/seo"

export const metadata: Metadata = publicPageMetadata({
  path: OTO_SERVIS_PROGRAMI_PATH,
  title: OTO_SERVIS_PROGRAMI_TITLE,
  description: OTO_SERVIS_PROGRAMI_DESCRIPTION,
})

const workflow = [
  { title: "Aracı kabul edin", description: "Müşteri ve araç bilgisini açın; kabul fotoğraflarını aynı kayda ekleyin.", icon: Camera },
  { title: "İş emrini oluşturun", description: "Şikâyeti, yapılacak işleri ve sorumlu teknisyeni ekip için görünür tutun.", icon: ClipboardList },
  { title: "Parça ve işçiliği kaydedin", description: "Kullanılan parçaları, işçilikleri ve tutarları iş emrinde bir araya getirin.", icon: Wrench },
  { title: "Onayı ve ilerlemeyi izleyin", description: "Teklif, müşteri onayı ve işin güncel durumunu aynı akıştan takip edin.", icon: BadgeCheck },
  { title: "Teslimatı tamamlayın", description: "Yapılan işlemler ve ödeme bilgileriyle araç kaydını eksiksiz kapatın.", icon: Check },
] as const

const applicationStructuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "BakımX",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}${OTO_SERVIS_PROGRAMI_PATH}`,
  description: OTO_SERVIS_PROGRAMI_DESCRIPTION,
}

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: OTO_SERVIS_PROGRAMI_FAQS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
}

export default function OtoServisProgramiPage() {
  return (
    <>
      <JsonLd data={[applicationStructuredData, faqStructuredData]} />
      <Header />
      <main className="overflow-hidden">
        <section className="relative border-b bg-background">
          <div className="absolute inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b from-primary/10 to-transparent" />
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:px-8 lg:py-24">
            <div>
              <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary-strong">
                Araç kabulden teslimata tek akış
              </p>
              <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {OTO_SERVIS_PROGRAMI_H1}
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                {OTO_SERVIS_PROGRAMI_INTRO}
              </p>
              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <Button asChild size="lg">
                  <Link href="/register">
                    Ücretsiz deneyin
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <span className="text-sm text-muted-foreground">Kurulum gerekmez · Tarayıcıdan kullanılır</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
              <div className="absolute -inset-4 -z-10 rotate-2 rounded-3xl bg-primary/10" />
              <figure className="overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-primary/10">
                <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-3">
                  <span className="font-mono text-xs font-medium text-muted-foreground">İŞ EMRİ · ÖRNEK EKRAN</span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-success-strong">
                    <span className="size-2 rounded-full bg-success" aria-hidden="true" />
                    Serviste
                  </span>
                </div>
                <Image
                  src="/landing/screens/order-detail.png"
                  alt="BakımX örnek iş emri detay ekranı"
                  width={1200}
                  height={800}
                  className="h-auto w-full"
                  priority
                />
                <figcaption className="border-t px-4 py-3 text-xs leading-5 text-muted-foreground">
                  Temsili verilerle gösterilen gerçek BakımX ürün ekranı.
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="bg-navy py-16 text-navy-foreground sm:py-20" aria-labelledby="akis-baslik">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-navy-foreground/70">Servis akışı</p>
              <h2 id="akis-baslik" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Bir araç geldiğinde beş adım</h2>
              <p className="mt-4 text-base leading-7 text-navy-foreground/70">Ekran ekran dolaşmak yerine aracın kaydını ilerletin. Ekip, sıradaki işi aynı akıştan görsün.</p>
            </div>
            <ol className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-navy-foreground/15 bg-navy-foreground/15 md:grid-cols-5">
              {workflow.map((step, index) => {
                const Icon = step.icon
                return (
                  <li key={step.title} className="relative bg-navy p-5 sm:p-6">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm text-navy-foreground/60">0{index + 1}</span>
                      <Icon className="size-5 text-navy-foreground/80" aria-hidden="true" />
                    </div>
                    <h3 className="mt-8 text-base font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-navy-foreground/65">{step.description}</p>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>

        <section className="py-16 sm:py-24" aria-labelledby="uygunluk-baslik">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary-strong">Doğru seçim mi?</p>
                <h2 id="uygunluk-baslik" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">BakımX hangi servisler için uygun?</h2>
                <p className="mt-5 text-base leading-7 text-muted-foreground">Araç ve iş takibini kâğıt, mesaj ve farklı dosyalar arasında yürütmek yerine ekibin ortak bir kayıt üzerinden çalışmasını isteyen oto servisler için uygundur.</p>
                <ul className="mt-7 space-y-4">
                  {["Telefon veya tabletten hızlı araç kabul yapmak isteyenler", "İş emri, parça, işçilik ve fotoğrafları birlikte tutmak isteyenler", "Servisteki araçların güncel durumunu ekipçe görmek isteyenler"].map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-6 sm:text-base">
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success-strong"><Check className="size-4" aria-hidden="true" /></span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border bg-muted/35 p-6 sm:p-8">
                <h3 className="text-xl font-semibold">Hangi durumda uygun olmayabilir?</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">Yalnızca ön muhasebe arayan, servis operasyonu yürütmeyen veya internetsiz masaüstü programı kullanmak zorunda olan işletmeler için BakımX doğru araç olmayabilir.</p>
                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border bg-background p-5">
                    <Smartphone className="size-6 text-primary-strong" aria-hidden="true" />
                    <h4 className="mt-4 font-semibold">Mobil kullanım</h4>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Kabul ve takip adımları telefon ekranında çalışır.</p>
                  </div>
                  <div className="rounded-xl border bg-background p-5">
                    <PackageSearch className="size-6 text-primary-strong" aria-hidden="true" />
                    <h4 className="mt-4 font-semibold">Servis odağı</h4>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Akış, araç ve iş emri çevresinde düzenlenir.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/25 py-16 sm:py-24" aria-labelledby="ekranlar-baslik">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary-strong">Gerçek ürün ekranları</p>
              <h2 id="ekranlar-baslik" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Servisteki kayıt, müşteriye giden bilgiyle aynı yerde</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">İş emrindeki işlemleri ekip takip eder; paylaşım ekranı müşterinin yapılanları anlaşılır biçimde görmesini sağlar.</p>
            </div>
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              {[
                { src: "/landing/screens/order-detail.png", alt: "BakımX iş emri detayında parça ve işçilik kayıtları", label: "Servis içi iş emri · Örnek veri", text: "İşler, parçalar ve işçilikler tek iş emrinde izlenir." },
                { src: "/landing/screens/public-tracking.png", alt: "BakımX müşteri araç takip ekranı", label: "Müşteri takip ekranı · Örnek veri", text: "Araç durumu ve işlem özeti paylaşılabilir ekranda görülür." },
              ].map((screen) => (
                <figure key={screen.src} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                  <div className="border-b px-4 py-3 font-mono text-xs font-medium text-muted-foreground">{screen.label}</div>
                  <Image src={screen.src} alt={screen.alt} width={1200} height={800} className="h-auto w-full" />
                  <figcaption className="border-t px-5 py-4 text-sm leading-6 text-muted-foreground">{screen.text}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-24" aria-labelledby="detay-baslik">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 id="detay-baslik" className="text-3xl font-bold tracking-tight sm:text-4xl">İhtiyacınıza göre ayrıntıya inin</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">Kategoriye karar verirken akışları, güncel paketleri ve ürünü nasıl görebileceğinizi ayrı sayfalarda inceleyin.</p>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                { href: "/dijital-arac-kabul", title: "Dijital araç kabul", text: "Ruhsat, kabul fotoğrafları ve hasar kaydı akışını inceleyin." },
                { href: "/is-emri-programi", title: "İş emri programı", text: "İş, parça, işçilik ve onay takibinin ayrıntılarını görün." },
                { href: "/fiyatlar", title: "Paketler ve fiyatlar", text: "Güncel paket kapsamlarını ve KDV dahil fiyatları karşılaştırın." },
                { href: "/karsilastir/defter-excel-oto-servis-programi", title: "Defter, Excel ve program karşılaştırması", text: "Kayıt yöntemlerini dengeli ölçütlerle karşılaştırın." },
                { href: "/demo", title: "Canlı demo talep edin", text: "BakımX'i servisinizin çalışma şekline göre birlikte inceleyin." },
              ].map((item) => (
                <Link key={item.href} href={item.href} className="group rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <span className="flex items-center justify-between gap-4 font-semibold text-foreground">
                    {item.title}
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-muted-foreground">{item.text}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t bg-background py-16 sm:py-24" aria-labelledby="sss-baslik">
          <div className="mx-auto grid max-w-5xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.65fr_1.35fr] lg:px-8">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary-strong">Sık sorulanlar</p>
              <h2 id="sss-baslik" className="mt-3 text-3xl font-bold tracking-tight">Oto servis programı hakkında</h2>
            </div>
            <dl className="divide-y border-y">
              {OTO_SERVIS_PROGRAMI_FAQS.map((item) => (
                <div key={item.question} className="py-6 first:pt-0 lg:first:pt-6">
                  <dt className="font-semibold text-foreground">{item.question}</dt>
                  <dd className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">{item.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="bg-primary py-14 text-primary-foreground sm:py-16">
          <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-7 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Servis akışınızı tek kayıtta toplamaya başlayın</h2>
              <p className="mt-2 text-sm leading-6 text-primary-foreground sm:text-base">E-posta doğrulamasından sonra 7 iş günlük ücretsiz kullanımınız başlar.</p>
            </div>
            <Button asChild size="lg" variant="secondary">
              <Link href="/register">
                Ücretsiz deneyin
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
