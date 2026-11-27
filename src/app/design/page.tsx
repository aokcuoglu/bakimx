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
import { StatusBadge, PaymentBadge, CollectionStatusBadge } from "@/components/shared/status-badge"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PRIVATE_ROBOTS, brandedTitle } from "@/lib/seo"
import { MarketingKitShowcase } from "./marketing-kit"
import { RecordPatterns } from "./record-patterns"
import { ColorCard } from "./copyable-swatch"
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants"
import { cn } from "@/lib/utils"

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

const NAV = [
  { href: "#palette", label: "Palette" },
  { href: "#typography", label: "Typography" },
  { href: "#components", label: "Components" },
  { href: "#cards", label: "Cards" },
  { href: "#forms", label: "Forms" },
  { href: "#spacing", label: "Spacing" },
] as const

const BRAND_COLORS = [
  {
    name: "Navy",
    hex: "#071F49",
    token: "bg-navy / variant=navy",
    description: "Eski koyu CTA. Yeni birincil düğme primary mavisidir.",
    swatchClass: "bg-navy",
  },
  {
    name: "Brand",
    hex: "#2F84FF",
    token: "bg-brand",
    description: "Marka aksanı — grafik ve vurgu; CTA dolgusu değil.",
    swatchClass: "bg-brand",
  },
  {
    name: "Primary",
    hex: "#266DF0",
    token: "bg-primary / text-primary",
    description: "Birincil düğme, bağlantı, seçim ve odak.",
    swatchClass: "bg-primary",
  },
  {
    name: "Primary strong",
    hex: "#004DCF",
    token: "text-primary-strong",
    description: "Tonlu bg-primary/10 üzeri metin (kontrast).",
    swatchClass: "bg-primary-strong",
  },
] as const

const SURFACE_COLORS = [
  {
    name: "Background",
    hex: "#F7F8FA",
    token: "bg-background",
    description: "Sayfa zemini — açık Vercel yüzeyi.",
    swatchClass: "bg-background",
  },
  {
    name: "Card",
    hex: "#FFFFFF",
    token: "bg-card",
    description: "Kart, dialog ve panel yüzeyi.",
    swatchClass: "bg-card",
  },
  {
    name: "Muted",
    hex: "#EDF2F8",
    token: "bg-muted",
    description: "İkincil yüzey, hover, footer şeritleri.",
    swatchClass: "bg-muted",
  },
  {
    name: "Border",
    hex: "#DCE2E8",
    token: "border-border",
    description: "1px ayraç — hairline border.",
    swatchClass: "bg-border",
  },
  {
    name: "Sidebar",
    hex: "#071F49",
    token: "bg-sidebar",
    description: "Uygulama kenar çubuğu (açık nötr yüzey).",
    swatchClass: "bg-sidebar",
  },
] as const

const TEXT_COLORS = [
  {
    name: "Foreground",
    hex: "#171717",
    token: "text-foreground",
    description: "Ana metin, başlık, kayıt/kurulum birincil dolgu.",
    swatchClass: "bg-foreground",
  },
  {
    name: "Muted foreground",
    hex: "#60646C",
    token: "text-muted-foreground",
    description: "Yardımcı metin — açık yüzeylerde AA kontrastlı nötr gri.",
    swatchClass: "bg-muted-foreground",
  },
  {
    name: "Muted strong",
    hex: "#171717",
    token: "text-muted-foreground-strong",
    description: "Tonlu yüzeylerde yardımcı metin.",
    swatchClass: "bg-foreground",
  },
] as const

const SEMANTIC_COLORS = [
  {
    name: "Success",
    hex: "#189A30",
    token: "bg-success / text-success-strong",
    description: "Başarı Alert ve toast.",
    swatchClass: "bg-success",
  },
  {
    name: "Warning",
    hex: "#D19200",
    token: "bg-warning / text-warning-strong",
    description: "Uyarı durumu.",
    swatchClass: "bg-warning",
  },
  {
    name: "Destructive",
    hex: "#E7000B",
    token: "bg-destructive / text-destructive-strong",
    description: "Hata ve yıkıcı eylem.",
    swatchClass: "bg-destructive",
  },
  {
    name: "WhatsApp",
    hex: "#25D366",
    token: "bg-whatsapp",
    description: "WhatsApp aksiyonu (bilinçli AA istisnası).",
    swatchClass: "bg-whatsapp",
  },
] as const

const TYPE_ROWS = [
  {
    id: "display-xl",
    sample: "İş emri 10 saniyede",
    meta: "Inter · ~76–84px · 600 · tight tracking · marketing H1",
    className:
      "text-[clamp(2.25rem,5vw,4.5rem)] font-semibold tracking-tight text-foreground",
  },
  {
    id: "display-md",
    sample: "Yeni iş emri oluştur",
    meta: "Inter · 20/28px · 600 · app title",
    className: "text-page-title text-foreground",
  },
  {
    id: "headline",
    sample: "Müşteri ve araç bilgileri",
    meta: "Inter · 16/20px · 600",
    className: "text-base leading-5 font-semibold text-foreground",
  },
  {
    id: "card-title",
    sample: "Bugünkü iş emirleri",
    meta: "Inter · 14/20px · 500",
    className: "text-sm leading-5 font-medium text-foreground",
  },
  {
    id: "body",
    sample:
      "Açık yüzey, ince border ve koyu metin. Parlak mavi CTA kullanılmaz.",
    meta: "Inter · 14/20px · 400 · default body",
    className: "text-sm leading-5 text-foreground",
  },
  {
    id: "body-sm",
    sample: "Form etiketleri, tablo hücreleri ve yardımcı UI metni.",
    meta: "Inter · 14px · 400–500",
    className: "text-sm text-foreground",
  },
  {
    id: "caption",
    sample: "Yardımcı açıklama — muted-foreground.",
    meta: "Inter · 12/16px · 500 · muted",
    className: "text-xs leading-4 font-medium text-muted-foreground",
  },
  {
    id: "button",
    sample: "Kaydet ve devam et",
    meta: "Inter · 14px · 500 · lh 140% · tracking −0.02em",
    className:
      "text-sm font-medium leading-[1.4] tracking-[-0.02em] text-foreground",
  },
  {
    id: "mono",
    sample: "34 ABC 123 · WO-2026-0042",
    meta: "Geist Mono · 13px",
    className: "font-mono text-[13px] text-foreground",
  },
] as const

const SPACING = [
  { token: "xxs", px: "4" },
  { token: "xs", px: "8" },
  { token: "sm", px: "12" },
  { token: "md", px: "16" },
  { token: "lg", px: "24" },
  { token: "xl", px: "32" },
  { token: "xxl", px: "48" },
  { token: "section", px: "64–120" },
] as const

const RADIUS = [
  { token: "none", px: "0", className: "rounded-none", use: "Tablo / ayraç" },
  { token: "xs", px: "4", className: "rounded-xs", use: "Küçük chip" },
  {
    token: "sm",
    px: "6",
    className: "rounded-sm",
    use: "Küçük iç öğe",
  },
  { token: "md", px: "8", className: "rounded-md", use: "Menü satırı" },
  {
    token: "control",
    px: "10 / 8",
    className: "rounded-(--control-radius)",
    use: "Input, Select, Textarea, Alert",
  },
  {
    token: "lg",
    px: "12",
    className: "rounded-lg",
    use: "Card, Popover",
  },
  {
    token: "xl",
    px: "12",
    className: "rounded-xl",
    use: "Sabit 12px — --radius'tan bağımsız; açılır menü/liste",
  },
  {
    token: "panel",
    px: "14",
    className: "rounded-(--radius-panel)",
    use: "Panel, KPI kartı",
  },
  {
    token: "dialog",
    px: "18",
    className: "rounded-[var(--radius-dialog)]",
    use: "Dialog, mobil sheet",
  },
  {
    token: "full",
    px: "9999",
    className: "rounded-full",
    use: "Avatar / pill",
  },
] as const

const BREAKPOINTS = [
  { name: "Mobile", width: "390px", note: "Tek sütun; CTA xl" },
  { name: "Tablet", width: "768px", note: "İki sütun kartlar" },
  { name: "Desktop", width: "1280px", note: "Uygulama + public grid" },
  { name: "Wide", width: "1440px", note: "Ürün sahnesi üst sınır" },
] as const

function Section({
  id,
  index,
  title,
  eyebrow,
  children,
}: {
  id: string
  index: string
  title: string
  eyebrow?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-6 border-t border-border pt-12">
      <div className="space-y-2">
        <p className="font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {index} — {eyebrow ?? title}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

function ColorGroup({
  title,
  colors,
}: {
  title: string
  colors: readonly {
    name: string
    hex: string
    token: string
    description: string
    swatchClass: string
  }[]
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {colors.map((color) => (
          <ColorCard key={color.token + color.name} {...color} />
        ))}
      </div>
    </div>
  )
}

export default function DesignSystemPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
              aria-label="BakımX ana sayfa"
            >
              <BrandLogo height={32} />
            </Link>
            <nav
              aria-label="Design system"
              className="hidden items-center gap-0.5 md:flex"
            >
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
          <Button variant="navy" size="sm" asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-10 sm:px-6 sm:py-14">
        <div className="max-w-3xl space-y-5 pb-8">
          <Badge variant="outline" className="rounded-sm font-mono text-[11px]">
            DESIGN.md · getdesign-style palette
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Design System Analysis of BakımX
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            Attio yüzey disiplini, Vercel açık katmanlar ve Linear yoğunluk.
            Açık <code className="rounded-sm bg-muted px-1 font-mono text-[13px]">card</code>{" "}
            zemin, ince border, koyu{" "}
            <code className="rounded-sm bg-muted px-1 font-mono text-[13px]">foreground</code>
            . Tek marka voltajı{" "}
            <strong className="font-medium text-foreground">navy</strong> CTA;
            primary mavi yalnız link ve odak. Yapı{" "}
            <a
              href="https://getdesign.md/linear.app/design-md"
              className="text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              getdesign.md / Linear
            </a>{" "}
            preview düzenini izler; token değerleri BakımX&apos;e aittir.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="navy" asChild>
              <a href="#palette">Palette</a>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Ana sayfa</Link>
            </Button>
          </div>
        </div>

        <Section id="palette" index="01" title="Color Palette" eyebrow="Color Palette">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Hex&apos;e tıklayınca panoya kopyalanır. Kaynak:{" "}
            <code className="rounded-sm bg-muted px-1 font-mono text-[12px]">
              src/app/globals.css
            </code>{" "}
            + DESIGN.md. Call-site&apos;ta sabit hex yazılmaz.
          </p>
          <div className="space-y-8">
            <ColorGroup title="Brand & Accent" colors={BRAND_COLORS} />
            <ColorGroup title="Surface" colors={SURFACE_COLORS} />
            <ColorGroup title="Text" colors={TEXT_COLORS} />
            <ColorGroup title="Semantic" colors={SEMANTIC_COLORS} />
          </div>
        </Section>

        <Section id="typography" index="02" title="Typography Scale" eyebrow="Typography">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {TYPE_ROWS.map((row, index) => (
              <div
                key={row.id}
                className={cn(
                  "grid gap-3 p-4 sm:grid-cols-[9rem_1fr] sm:items-center",
                  index > 0 && "border-t border-border"
                )}
              >
                <div className="space-y-1">
                  <p className="font-mono text-xs font-medium text-foreground">
                    {row.id}
                  </p>
                  <p className="font-mono text-[11px] leading-snug text-muted-foreground">
                    {row.meta}
                  </p>
                </div>
                <p className={row.className}>{row.sample}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section id="components" index="03" title="Button Variants" eyebrow="Buttons">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Birincil eylem public&apos;te{" "}
            <code className="rounded-sm bg-muted px-1 font-mono text-[12px]">
              variant=&quot;navy&quot;
            </code>
            , kayıt/kurulumda{" "}
            <code className="rounded-sm bg-muted px-1 font-mono text-[12px]">
              foreground
            </code>
            . Parlak primary dolgu CTA değildir.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["navy", "Navy — public CTA"],
                ["foreground", "Foreground — kayıt/kurulum"],
                ["outline", "Outline — ikincil"],
                ["ghost", "Ghost — geri / kapat"],
                ["default", "Default primary — kaçın"],
                ["whatsapp", "WhatsApp"],
                ["destructive", "Destructive"],
                ["destructive-outline", "Destructive outline — ikincil yıkıcı eylem (İptal, Pasif Yap)"],
                ["destructive-ghost", "Destructive ghost — satır içi sil / kaldır / iptal"],
                ["tint", "Tint — birincil tonlu seçili / önerilen eylem"],
                ["tint-ghost", "Tint ghost — satır içi birincil eylem (ekle, değiştir)"],
                ["success-ghost", "Success ghost — satır içi tamamla / onayla"],
                ["warning-tint", "Warning tint — dikkat isteyen seçim (düşük güvenli OCR önerisi)"],
                ["success", "Success"],
                ["warning", "Warning"],
                ["field", "Field — alan görünümlü seçici (tarih)"],
              ] as const
            ).map(([variant, label]) => (
              <div
                key={variant}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
              >
                <p className="font-mono text-[11px] text-muted-foreground">
                  button-{variant}
                </p>
                <Button variant={variant} className="w-fit">
                  {label.split(" — ")[0]}
                </Button>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <div className="space-y-3 rounded-lg border border-border bg-card p-4" data-testid="button-on-photo">
            <p className="font-mono text-[11px] text-muted-foreground">
              on-photo · on-photo-scrim · fotoğraf / kamera katmanı üstünde (koyu zemin)
            </p>
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-black p-4">
              <Button variant="on-photo">on-photo</Button>
              <Button variant="on-photo-ghost">on-photo-ghost</Button>
              <Button variant="on-photo-scrim">on-photo-scrim</Button>
            </div>
          </div>
          <div className="space-y-3 rounded-lg border border-border bg-card p-4" data-testid="button-sizes">
            <p className="font-mono text-[11px] text-muted-foreground">
              sizes · telefon / md+ (docs/ui-control-sizing.md)
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  ["xl", "52 / 48"],
                  ["lg", "50 / 44"],
                  ["default", "44 / 36"],
                  ["sm", "36 / 32"],
                  ["toolbar", "36 / 32"],
                  ["xs", "32 / 28"],
                  ["compact", "32 / 28"],
                ] as const
              ).map(([size, px]) => (
                <Button key={size} variant="navy" size={size}>
                  {size} · {px}
                </Button>
              ))}
            </div>
            <div className="grid items-start gap-3 sm:grid-cols-3">
              <p className="text-sm text-muted-foreground">
                inline — metin içinde{" "}
                <Button variant="link" size="inline">
                  bağlantı
                </Button>
                , boyu çevreden
              </p>
              <Button variant="outline" size="row" className="w-full">
                <span className="min-w-0 flex-1">
                  <span className="block text-foreground">row</span>
                  <span className="block text-xs text-muted-foreground">liste satırı, seçenek kartı, bırakma alanı</span>
                </span>
              </Button>
              <Button variant="secondary" size="tile" className="aspect-[4/3] w-full justify-center text-muted-foreground">
                tile · görsel karosu
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">status</Badge>
              <Badge>default</Badge>
              <Badge variant="secondary">secondary</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2" data-testid="badge-tints">
              <Badge variant="success-tint">success-tint</Badge>
              <Badge variant="warning-tint">warning-tint</Badge>
              <Badge variant="destructive-tint">destructive-tint</Badge>
              <Badge variant="primary-tint">primary-tint</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-3" data-testid="status-badge-surfaces">
              {(["bg-card", "bg-background", "bg-muted"] as const).map((surface) => (
                <div key={surface} className={cn("flex flex-wrap items-center gap-1.5 rounded-md border border-border p-2", surface)}>
                  {Object.keys(ORDER_STATUS).map((key) => (
                    <StatusBadge key={key} status={key} />
                  ))}
                  {Object.keys(PAYMENT_STATUS).map((key) => (
                    <PaymentBadge key={key} status={key} />
                  ))}
                  <CollectionStatusBadge status="refunded" />
                  <Badge variant="destructive">destructive</Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3 rounded-lg border border-border bg-card p-4" data-testid="selector-sizes">
            <p className="font-mono text-[11px] text-muted-foreground">
              seçiciler · size=&quot;control&quot; 44 / 36 — telefonda dokunulan sekme ve seçici (#854)
            </p>
            <div className="grid items-start gap-4 lg:grid-cols-2">
              <Tabs defaultValue="parts">
                <TabsList variant="line" size="control" className="w-full justify-start border-b border-border" aria-label="Örnek sayfa sekmesi">
                  <TabsTrigger value="parts">line · control</TabsTrigger>
                  <TabsTrigger value="labor">İşçilikler</TabsTrigger>
                </TabsList>
              </Tabs>
              <Tabs defaultValue="intake">
                <TabsList size="control" className="w-full" aria-label="Örnek segment sekmesi">
                  <TabsTrigger value="intake">segment · control</TabsTrigger>
                  <TabsTrigger value="delivery">Teslim</TabsTrigger>
                </TabsList>
              </Tabs>
              <ToggleGroup type="single" defaultValue="all" variant="outline" size="control" className="flex-wrap" aria-label="Örnek seçim">
                <ToggleGroupItem value="all">outline · control</ToggleGroupItem>
                <ToggleGroupItem value="sms">SMS</ToggleGroupItem>
              </ToggleGroup>
              <ToggleGroup type="single" defaultValue="monthly" variant="segment" size="control" aria-label="Örnek dönem">
                <ToggleGroupItem value="monthly">segment · control</ToggleGroupItem>
                <ToggleGroupItem value="yearly">Yıllık</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <p className="text-xs text-muted-foreground">
              Varsayılan line sekme (28px) ve Toggle (32px) yalnız masaüstü yoğun yüzeyde kalır; örnek: aşağıdaki kayıt kalıbı.
            </p>
          </div>
        </Section>

        <Section id="cards" index="04" title="Cards & Containers" eyebrow="Cards">
          <RecordPatterns />
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border border-border shadow-none ring-0">
              <CardHeader className="border-b">
                <CardTitle>feature-card</CardTitle>
                <CardDescription>
                  Açık card + border-b başlık. bg-primary renk bloğu yok.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-(--card-spacing)">
                <p className="text-sm text-muted-foreground">
                  İş emri, şase parça listesi ve onay akışı tek yüzeyde.
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm">
                  İncele
                </Button>
              </CardFooter>
            </Card>

            <Card className="border border-border shadow-none ring-0">
              <CardHeader className="border-b">
                <CardTitle>status · Alert</CardTitle>
                <CardDescription>
                  Durum kutuları ad-hoc değil shadcn Alert.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 pt-(--card-spacing)">
                <Alert>
                  <Info />
                  <AlertTitle>Nötr not</AlertTitle>
                  <AlertDescription>
                    Rehber ipuçları default Alert kullanır.
                  </AlertDescription>
                </Alert>
                <Alert variant="success">
                  <CheckCircle2 />
                  <AlertTitle>Başarılı</AlertTitle>
                  <AlertDescription>İş emri kaydedildi.</AlertDescription>
                </Alert>
                <Alert variant="warning">
                  <AlertTriangle />
                  <AlertTitle>Uyarı</AlertTitle>
                  <AlertDescription>Stok eşiği altında.</AlertDescription>
                </Alert>
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>Hata</AlertTitle>
                  <AlertDescription>Oturum süresi doldu.</AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </Section>

        <Section id="forms" index="05" title="Form Elements" eyebrow="Forms">
          <div className="grid max-w-xl gap-4 rounded-lg border border-border bg-card p-5">
            <div className="space-y-2">
              <Label htmlFor="design-plate">Plaka · text-input</Label>
              <Input
                id="design-plate"
                placeholder="34 ABC 123"
                defaultValue="34 BX 001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="design-note">Not · textarea</Label>
              <Textarea
                id="design-note"
                placeholder="Müşteri notu…"
                rows={3}
              />
            </div>
            <div className="space-y-2" data-testid="input-sizes">
              <p className="font-mono text-[11px] text-muted-foreground">
                input sizes · telefon / md+
              </p>
              {(
                [
                  ["lg", "50 / 44px — plaka, teslim kodu"],
                  ["default", "44 / 36px — form, diyalog, arama"],
                  ["sm", "36 / 32px — filtre araç çubuğu"],
                  ["compact", "32 / 28px — tablo satırı düzenleyici"],
                ] as const
              ).map(([size, use]) => (
                <Input
                  key={size}
                  size={size}
                  aria-label={`Input size ${size}`}
                  placeholder={`size="${size}" · ${use}`}
                />
              ))}
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
            <p className="text-xs text-muted-foreground">
              Köşe, yükseklik ve metin bileşenden ve{" "}
              <code className="font-mono">size</code> prop&apos;undan gelir;
              çağrı yerinde <code className="font-mono">className</code> ile
              ezilmez (docs/ui-control-sizing.md).
            </p>
          </div>
        </Section>

        <Section id="spacing" index="06" title="Spacing & Radius" eyebrow="Spacing">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Spacing</h3>
              <div className="space-y-2 rounded-lg border border-border bg-card p-4">
                {SPACING.map((row) => (
                  <div key={row.token} className="flex items-center gap-3">
                    <span className="w-16 font-mono text-xs text-muted-foreground">
                      {row.token}
                    </span>
                    <span className="w-14 font-mono text-xs text-foreground">
                      {row.px}px
                    </span>
                    <span
                      className="h-2 rounded-sm bg-navy/80"
                      style={{
                        width: row.px.includes("–")
                          ? 64
                          : Math.min(Number(row.px) * 1.5, 180),
                      }}
                      aria-hidden
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Radius</h3>
              <p className="text-xs text-muted-foreground">
                Girdi 10px (md+ 8px), Card 12px, panel 14px, diyalog 18px. Düğmeler hap.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {RADIUS.map((row) => (
                  <div
                    key={row.token}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
                  >
                    <div
                      className={cn(
                        "flex h-14 items-end justify-end bg-navy/90 p-1.5",
                        row.className
                      )}
                    >
                      <span className="rounded-sm bg-card px-1 py-0.5 font-mono text-[10px] text-foreground">
                        {row.px}
                      </span>
                    </div>
                    <div>
                      <p className="font-mono text-xs font-medium text-foreground">
                        {row.token}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {row.use}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section id="elevation" index="07" title="Elevation & Depth" eyebrow="Elevation">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["Level 0", "bg-background", "Düz sayfa", "shadow-none"],
                ["Level 1", "bg-card border", "Card / panel", "shadow-none + border"],
                ["Level 2", "bg-card", "Popover / dropdown", "shadow-md"],
                ["Level 3", "bg-card", "Dialog / sheet", "shadow-lg"],
              ] as const
            ).map(([level, surface, use, shadow]) => (
              <div
                key={level}
                className={cn(
                  "rounded-lg border border-border bg-card p-4",
                  shadow === "shadow-md" && "shadow-md",
                  shadow === "shadow-lg" && "shadow-lg"
                )}
              >
                <p className="font-mono text-xs font-medium text-foreground">
                  {level}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{use}</p>
                <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                  {surface} · {shadow}
                </p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Ağır <code className="font-mono text-[12px]">shadow-2xl</code>{" "}
            yok; hiyerarşi border + sınırlı gölge ile kurulur.
          </p>
        </Section>

        <Section id="responsive" index="08" title="Responsive Behavior" eyebrow="Responsive">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid grid-cols-[1fr_5rem_1fr] gap-2 border-b border-border bg-muted/40 px-4 py-2 font-mono text-[11px] text-muted-foreground">
              <span>Name</span>
              <span>Width</span>
              <span>Key changes</span>
            </div>
            {BREAKPOINTS.map((row) => (
              <div
                key={row.name}
                className="grid grid-cols-[1fr_5rem_1fr] gap-2 border-t border-border px-4 py-3 text-sm first:border-t-0"
              >
                <span className="font-medium text-foreground">{row.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {row.width}
                </span>
                <span className="text-muted-foreground">{row.note}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Dokunma hedefleri ≥38–44px. Mobil ana CTA{" "}
            <code className="font-mono text-[12px]">size=&quot;xl&quot;</code>.
          </p>
        </Section>

        <Section id="marketing" index="09" title="Pazarlama kiti (e-santral)" eyebrow="Marketing">
          <p className="text-sm text-muted-foreground">
            Ana sayfa (#781) bileşenleri: <code className="font-mono text-[12px]">src/components/marketing/kit</code>,
            token&apos;lar <code className="font-mono text-[12px]">--mk-*</code> (yalnız açık tema). Belge:
            docs/design-pattern-esantral.md §7.
          </p>
          <MarketingKitShowcase />
        </Section>

        <footer className="border-t border-border pt-8 text-sm text-muted-foreground">
          <p>
            Sözleşme:{" "}
            <span className="font-mono text-foreground">DESIGN.md</span>
            {" · "}
            Referans düzen:{" "}
            <a
              href="https://getdesign.md/linear.app/design-md"
              className="text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              getdesign.md/linear.app
            </a>
            {" · "}
            Token:{" "}
            <span className="font-mono text-foreground">
              src/app/globals.css
            </span>
            . Sayfa indekslenmez; <span className="font-mono">ui.bakimx.com</span>{" "}
            adayı.
          </p>
        </footer>
      </main>
    </div>
  )
}
