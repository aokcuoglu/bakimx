import Link from "next/link"
import { AlertCircle, Clock3, Link2Off } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BrandLogo } from "@/components/shared/brand-logo"

export type PublicLinkProblem = "invalid" | "expired" | "inactive" | "error"

const CONTENT: Record<PublicLinkProblem, { title: string; description: string; Icon: typeof AlertCircle }> = {
  invalid: {
    title: "Bağlantı geçersiz",
    description: "Bağlantı eksik veya hatalı. Mesajdaki bağlantının tamamını açtığınızdan emin olun.",
    Icon: Link2Off,
  },
  expired: {
    title: "Bağlantının süresi dolmuş",
    description: "Bilgilerinizi korumak için bu bağlantı artık kullanılamıyor. İş yerinizden yeni bir bağlantı isteyin.",
    Icon: Clock3,
  },
  inactive: {
    title: "Bağlantı kapatılmış",
    description: "Bu bağlantı iş yeri tarafından kapatılmış. Güncel bağlantı için iş yerinizle iletişime geçin.",
    Icon: Link2Off,
  },
  error: {
    title: "Sayfa açılamadı",
    description: "Bağlantı kontrol edilirken bir sorun oluştu. İnternet bağlantınızı kontrol edip yeniden deneyin.",
    Icon: AlertCircle,
  },
}

export function PublicLinkState({ problem }: { problem: PublicLinkProblem }) {
  const { title, description, Icon } = CONTENT[problem]
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-muted p-4">
      <section className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm sm:p-8" aria-labelledby="public-link-title">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <Icon className="size-8 text-destructive-strong" aria-hidden />
        </div>
        <h1 id="public-link-title" className="text-xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        {problem === "error" && (
          <Button nativeButton={false} render={<Link href="" />} size="lg" className="mt-6 w-full">
            Tekrar dene
          </Button>
        )}
        <div className="mt-6 flex items-center justify-center gap-2 border-t pt-4 text-xs text-muted-foreground">
          <BrandLogo variant="icon-light" size="xs" alt="BakımX" />
          <span>Dijital servis bilgileri</span>
        </div>
      </section>
    </main>
  )
}
