import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BookOpen, FileSpreadsheet, MonitorSmartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Footer } from "@/components/sections/Footer"
import { Header } from "@/components/sections/Header"
import {
  COMPARISON_DESCRIPTION,
  COMPARISON_PATH,
  COMPARISON_ROWS,
  COMPARISON_TITLE,
} from "@/lib/landing/defter-excel-oto-servis-programi"
import { publicPageMetadata } from "@/lib/seo"

export const metadata: Metadata = publicPageMetadata({
  path: COMPARISON_PATH,
  title: COMPARISON_TITLE,
  description: COMPARISON_DESCRIPTION,
})

const options = [
  { title: "Defter", icon: BookOpen, text: "Basit ve fiziksel bir düzen isteyen, kaydı tek noktadan yürüten servisler için anlaşılır bir başlangıçtır." },
  { title: "Excel", icon: FileSpreadsheet, text: "Kendi tablo yapısını kurmak ve dosya paylaşımını yönetmek isteyen ekipler için esnektir." },
  { title: "Oto servis programı", icon: MonitorSmartphone, text: "Araç kabulden teslimata kadar kayıtları ilişkili ve ekipçe güncel tutmak isteyen servisler içindir." },
] as const

const relatedPages = [
  { href: "/oto-servis-programi", title: "Oto servis programı", text: "Araç kabulden teslimata bütün servis akışını görün." },
  { href: "/dijital-arac-kabul", title: "Dijital araç kabul", text: "Ruhsat, fotoğraf ve hasar kaydı adımlarını inceleyin." },
  { href: "/is-emri-programi", title: "İş emri programı", text: "İş, parça, işçilik ve onay kaydının ayrıntılarına bakın." },
  { href: "/rehber/arac-kabul-formu", title: "Araç kabul formu rehberi", text: "Eksiksiz kabul için uygulanabilir kontrol listesini okuyun." },
  { href: "/rehber/oto-servis-is-emri-nasil-hazirlanir", title: "İş emri hazırlama rehberi", text: "Bir iş emrinde bulunması gereken bilgileri öğrenin." },
] as const

export default function ComparisonPage() {
  return (
    <>
      <Header />
      <main>
        <section className="border-b bg-gradient-to-b from-primary/10 to-background py-16 sm:py-24">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary-strong">Dengeli seçim rehberi</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">Defter, Excel veya oto servis programı: hangisi ne zaman uygun?</h1>
            <p className="mt-6 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">Tek bir yöntem her servis için doğru değildir. Kayıt hacminize, ekibin çalışma biçimine ve takip ihtiyacınıza göre seçenekleri doğrulanabilir ölçütlerle karşılaştırın.</p>
          </div>
        </section>

        <section className="py-14 sm:py-20" aria-labelledby="secenekler-baslik">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 id="secenekler-baslik" className="text-3xl font-bold tracking-tight">Üç yaklaşımın güçlü olduğu yerler</h2>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {options.map(({ title, icon: Icon, text }) => (
                <article key={title} className="rounded-2xl border bg-card p-6">
                  <Icon className="size-7 text-primary-strong" aria-hidden="true" />
                  <h3 className="mt-5 text-xl font-semibold">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/25 py-14 sm:py-20" aria-labelledby="tablo-baslik">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 id="tablo-baslik" className="text-3xl font-bold tracking-tight">Ölçütlere göre karşılaştırma</h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">Tablo genel çalışma biçimlerini karşılaştırır. Excel dosyanızın yapısı veya servisinizdeki defter düzeni farklı sonuçlar verebilir.</p>
            <p className="mt-3 text-xs font-medium text-muted-foreground sm:hidden">Tüm seçenekleri görmek için tabloyu yatay kaydırın.</p>
            <div
              aria-label="Defter, Excel ve oto servis programı karşılaştırma tablosu"
              className="mt-8 overflow-x-auto rounded-2xl border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              tabIndex={0}
            >
              <table className="min-w-[760px] w-full border-collapse text-left text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    {['Ölçüt', 'Defter', 'Excel', 'Oto servis programı'].map((heading) => <th key={heading} scope="col" className="border-b px-5 py-4 font-semibold">{heading}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.criterion} className="align-top">
                      <th scope="row" className="w-40 px-5 py-5 font-semibold">{row.criterion}</th>
                      <td className="px-5 py-5 leading-6 text-muted-foreground">{row.notebook}</td>
                      <td className="px-5 py-5 leading-6 text-muted-foreground">{row.spreadsheet}</td>
                      <td className="px-5 py-5 leading-6 text-muted-foreground">{row.software}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="py-14 sm:py-20" aria-labelledby="incele-baslik">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <h2 id="incele-baslik" className="text-3xl font-bold tracking-tight">İhtiyacınıza göre ayrıntıya inin</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {relatedPages.map((item) => (
                <Link key={item.href} href={item.href} className="group rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <span className="flex items-center justify-between gap-4 font-semibold">{item.title}<ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden="true" /></span>
                  <span className="mt-2 block text-sm leading-6 text-muted-foreground">{item.text}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-primary py-14 text-primary-foreground sm:py-16">
          <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-7 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
            <div><h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Kendi servis akışınızla karşılaştırın</h2><p className="mt-2 text-sm leading-6 sm:text-base">BakımX&apos;in çalışma biçimini canlı demoda görün ve sorularınızı ekibimize iletin.</p></div>
            <Button asChild size="lg" variant="secondary"><Link href="/demo">Demo isteyin<ArrowRight aria-hidden="true" /></Link></Button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
