import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DemoCampaignIntro() {
  return (
    <section className="border-b bg-card px-5 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">BakımX canlı demo</p>
        <h1 className="mt-5 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">Araç kabulünden müşteri takibine, birlikte inceleyelim.</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">Araç bilgilerini kontrol edin, parça ve işçiliği aynı iş emrinde toplayın, müşterinizle takip linkini paylaşın. BakımX’in servisinizde nasıl çalışacağını görün.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="navy" size="xl"><Link href="#demo-talep">Demo isteyin <ArrowRight /></Link></Button>
          <Button asChild variant="outline" size="xl"><Link href="/demo/ozet">Tek sayfalık özeti açın</Link></Button>
        </div>
        <ol className="mt-12 grid gap-6 border-t pt-8 sm:grid-cols-3">
          {[
            ["01", "Araç kabulü", "Plakayı okutun, araç bilgilerini kontrol ederek kabulü başlatın. Ruhsat okuma ek özelliktir."],
            ["02", "İş emri", "Şikâyet, fotoğraf, parça ve işçiliği aynı kayıtta takip edin."],
            ["03", "Müşteri takibi", "Müşterinizin işlemleri görebileceği güvenli takip linkini paylaşın."],
          ].map(([number, title, text]) => <li key={number}><p className="font-mono text-xs text-muted-foreground">{number}</p><h2 className="mt-3 text-xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></li>)}
        </ol>
      </div>
    </section>
  );
}
