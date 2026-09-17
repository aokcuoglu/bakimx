import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react"
import { BrandLogo } from "@/components/shared/brand-logo"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PRIVATE_ROBOTS, brandedTitle } from "@/lib/seo"
import { CopyableSwatch } from "./copyable-swatch"

export const metadata: Metadata = {
  title: "Design System",
  description:
    "BakımX tasarım dili: renkler, tipografi, radius ve shadcn bileşen örnekleri.",
  robots: PRIVATE_ROBOTS,
  alternates: { canonical: "/design" },
  openGraph: {
    title: brandedTitle("Design System"),
    description:
      "BakımX tasarım dili: renkler, tipografi, radius ve shadcn bileşen örnekleri.",
    url: "/design",
    type: "website",
    locale: "tr_TR",
    siteName: "BakımX",
  },
}

const COLORS = [
  {
    name: "Navy",
    hex: "#071F49",
    token: "bg-navy",
    swatchClass: "bg-navy",
  },
  {
    name: "Brand",
    hex: "#2F84FF",
    token: "bg-brand",
    swatchClass: "bg-brand",
  },
  {
    name: "Primary",
    hex: "#0C65E8",
    token: "bg-primary",
    swatchClass: "bg-primary",
  },
  {
    name: "Primary strong",
    hex: "#004DCF",
    token: "text-primary-strong",
    swatchClass: "bg-primary-strong",
  },
  {
    name: "Foreground",
    hex: "#171717",
    token: "bg-foreground",
    swatchClass: "bg-foreground",
  },
  {
    name: "Muted foreground",
    hex: "#262626",
    token: "text-muted-foreground",
    swatchClass: "bg-muted-foreground",
  },
  {
    name: "Background",
    hex: "#F7F8FA",
    token: "bg-background",
    swatchClass: "bg-background",
  },
  {
    name: "Card",
    hex: "#FFFFFF",
    token: "bg-card",
    swatchClass: "bg-card",
  },
  {
    name: "Muted",
    hex: "#EDF2F8",
    token: "bg-muted",
    swatchClass: "bg-muted",
  },
  {
    name: "Border",
    hex: "#DCE2E8",
    token: "border-border",
    swatchClass: "bg-border",
  },
  {
    name: "Success",
    hex: "#189A30",
    token: "bg-success",
    swatchClass: "bg-success",
  },
  {
    name: "Warning",
    hex: "#D19200",
    token: "bg-warning",
    swatchClass: "bg-warning",
  },
  {
    name: "Destructive",
    hex: "#E7000B",
    token: "bg-destructive",
    swatchClass: "bg-destructive",
  },
  {
    name: "WhatsApp",
    hex: "#25D366",
    token: "bg-whatsapp",
    swatchClass: "bg-whatsapp",
  },
] as const

const TYPE_ROWS = [
  {
    label: "Display / marketing H1",
    sample: "İş emri 10 saniyede",
    className:
      "text-[clamp(2rem,4vw,3.5rem)] font-semibold tracking-tight text-foreground",
    meta: "Inter · ~32–56px · 600 · tight tracking",
  },
  {
    label: "App title",
    sample: "Yeni iş emri oluştur",
    className: "text-3xl font-semibold tracking-tight text-foreground",
    meta: "Inter · 30px · 600",
  },
  {
    label: "Title md",
    sample: "Müşteri ve araç bilgileri",
    className: "text-lg font-semibold text-foreground",
    meta: "Inter · 18px · 600",
  },
  {
    label: "Body",
    sample:
      "Açık yüzey, ince border ve koyu metin. Parlak mavi CTA kullanılmaz.",
    className: "text-base text-foreground",
    meta: "Inter · 16px · 400",
  },
  {
    label: "Body sm / UI",
    sample: "Form etiketleri ve tablo hücreleri bu boyutu kullanır.",
    className: "text-sm text-foreground",
    meta: "Inter · 14px · 400–500",
  },
  {
    label: "Muted / caption",
    sample: "Yardımcı açıklama metni — soluk gri değil, okunaklı koyu ton.",
    className: "text-sm text-muted-foreground",
    meta: "Inter · 14px · muted-foreground",
  },
  {
    label: "Button label",
    sample: "Kaydet ve devam et",
    className:
      "text-sm font-medium leading-[1.4] tracking-[-0.02em] text-foreground",
    meta: "Inter · 14px · 500 · −0.02em",
  },
  {
    label: "Mono",
    sample: "34 ABC 123 · WO-2026-0042",
    className: "font-mono text-[13px] text-foreground",
    meta: "Geist Mono · 13px",
  },
] as const

const RADIUS_ROWS = [
  { token: "none", px: "0", className: "rounded-none", use: "Tablo / ayraç" },
  { token: "xs", px: "4", className: "rounded-xs", use: "Küçük chip" },
  {
    token: "sm",
    px: "6",
    className: "rounded-sm",
    use: "Kontrol (Button, Input)",
  },
  { token: "md", px: "8", className: "rounded-md", use: "Menü satırı" },
  {
    token: "lg",
    px: "10",
    className: "rounded-lg",
    use: "Yüzey (Card, Dialog)",
  },
  { token: "xl", px: "12", className: "rounded-xl", use: "Büyük panel üst sınır" },
  {
    token: "full",
    px: "9999",
    className: "rounded-full",
    use: "Avatar / pill Badge",
  },
] as const

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-5">
      <div className="space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

export default function DesignSystemPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="BakımX ana sayfa"
          >
            <BrandLogo height={32} />
            <span className="hidden text-sm font-medium tracking-tight text-muted-foreground sm:inline">
              Design System
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <a
              href="#colors"
              className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Colors
            </a>
            <a
              href="#typography"
              className="hidden rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline"
            >
              Typography
            </a>
            <a
              href="#rounded"
              className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Rounded
            </a>
            <a
              href="#components"
              className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Components
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-16 px-4 py-10 sm:px-6 sm:py-14">
        <div className="space-y-4">
          <Badge variant="outline" className="rounded-sm font-mono text-[11px]">
            DESIGN.md · /design
          </Badge>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            BakımX Design System
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Attio yüzey disiplini, Vercel açık katmanlar ve Linear yoğunluk.
            Birincil CTA navy/foreground; primary mavi yalnız link ve odak.
            Kaynak sözleşme{" "}
            <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground">
              DESIGN.md
            </code>
            ; canlı token galerisi bu sayfa. İleride{" "}
            <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground">
              ui.bakimx.com
            </code>{" "}
            adayı.
          </p>
        </div>

        <Section
          id="colors"
          title="Colors"
          description="Hex’e tıklayınca panoya kopyalanır. Kaynak token’lar globals.css içindedir; call-site’ta sabit hex yazılmaz."
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {COLORS.map((color) => (
              <CopyableSwatch key={color.token} {...color} />
            ))}
          </div>
          <Card size="sm" className="border border-border shadow-none ring-0">
            <CardHeader className="border-b">
              <CardTitle>CTA rolleri</CardTitle>
              <CardDescription>
                Parlak primary dolgu birincil düğme değildir.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 pt-(--card-spacing)">
              <Button variant="navy">Navy (public CTA)</Button>
              <Button variant="foreground">Foreground (kayıt)</Button>
              <Button variant="outline">Outline (ikincil)</Button>
              <Button variant="ghost">Ghost (geri)</Button>
              <Button variant="default">Default primary (kaçın)</Button>
            </CardContent>
          </Card>
        </Section>

        <Section
          id="typography"
          title="Typography"
          description="Uygulama ve public yüzeylerde Inter; blog’da Switzer; kod/plaka için Geist Mono."
        >
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {TYPE_ROWS.map((row, index) => (
              <div
                key={row.label}
                className={
                  index === 0
                    ? "grid gap-3 p-4 sm:grid-cols-[11rem_1fr] sm:items-center"
                    : "grid gap-3 border-t border-border p-4 sm:grid-cols-[11rem_1fr] sm:items-center"
                }
              >
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    {row.label}
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {row.meta}
                  </p>
                </div>
                <p className={row.className}>{row.sample}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="rounded"
          title="Rounded"
          description="Kontrol = 6px (sm), yüzey = 10px (lg). 2xl+ yeni işte yok."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {RADIUS_ROWS.map((row) => (
              <div
                key={row.token}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
              >
                <div
                  className={`flex h-16 items-end justify-end bg-navy/90 p-2 ${row.className}`}
                >
                  <span className="rounded-sm bg-card px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                    {row.px}px
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {row.token}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {row.use}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="components"
          title="Components"
          description="Paylaşılan shadcn/Radix yüzeyleri. Durum kutuları için Alert; ham border+ikon kutusu yazılmaz."
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border border-border shadow-none ring-0">
              <CardHeader className="border-b">
                <CardTitle>Button + Input</CardTitle>
                <CardDescription>
                  Kontrol köşesi sm (6px); yükseklik size prop’undan gelir.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-(--card-spacing)">
                <div className="space-y-2">
                  <Label htmlFor="design-plate">Plaka</Label>
                  <Input
                    id="design-plate"
                    placeholder="34 ABC 123"
                    defaultValue="34 BX 001"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="foreground" size="sm">
                    Kaydet
                  </Button>
                  <Button variant="outline" size="sm">
                    İptal
                  </Button>
                  <Button variant="ghost" size="sm">
                    Geri
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>Varsayılan</Badge>
                  <Badge variant="secondary">İkincil</Badge>
                  <Badge variant="outline">Outline</Badge>
                </div>
              </CardContent>
              <CardFooter>
                <p className="text-xs text-muted-foreground">
                  Card yüzeyi rounded-lg (10px).
                </p>
              </CardFooter>
            </Card>

            <div className="space-y-3">
              <Alert>
                <Info />
                <AlertTitle>Nötr not</AlertTitle>
                <AlertDescription>
                  İpucu ve rehber notları default Alert kullanır; info tint
                  dekoratif CTA gibi okunmasın diye tercih edilmez.
                </AlertDescription>
              </Alert>
              <Alert variant="success">
                <CheckCircle2 />
                <AlertTitle>Başarılı</AlertTitle>
                <AlertDescription>
                  İş emri kaydedildi. Müşteriye WhatsApp özeti gönderilebilir.
                </AlertDescription>
              </Alert>
              <Alert variant="warning">
                <AlertTriangle />
                <AlertTitle>Uyarı</AlertTitle>
                <AlertDescription>
                  Stok eşiğinin altında 3 kalem var.
                </AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Hata</AlertTitle>
                <AlertDescription>
                  Oturum süresi doldu. Tekrar giriş yapın.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </Section>

        <footer className="border-t border-border pt-8 text-sm text-muted-foreground">
          <p>
            Sözleşme:{" "}
            <span className="font-mono text-foreground">DESIGN.md</span>
            {" · "}
            Token kaynağı:{" "}
            <span className="font-mono text-foreground">
              src/app/globals.css
            </span>
            {" · "}
            Bu sayfa indekslenmez; subdomain taşımaya hazır.
          </p>
        </footer>
      </main>
    </div>
  )
}
