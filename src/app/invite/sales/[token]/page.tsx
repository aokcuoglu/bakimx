import type { Metadata } from "next"
import Link from "next/link"
import { AlertCircle, CheckCircle2, Clock } from "lucide-react"
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel"
import { SalesAdvisorAcceptForm } from "@/components/sales/sales-advisor-accept-form"
import { prisma } from "@/lib/db"
import {
  hashSalesAdvisorInviteToken,
  isSalesAdvisorInviteExpired,
} from "@/lib/sales/advisor-invite"
import { PRIVATE_ROBOTS } from "@/lib/seo"

export const metadata: Metadata = {
  title: "Satış Danışmanı Daveti",
  robots: PRIVATE_ROBOTS,
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-muted lg:flex-row">
      <div className="lg:min-h-screen lg:w-[45%]"><AuthVisualPanel /></div>
      <div className="flex flex-1 items-center justify-center p-6 lg:p-10"><div className="w-full max-w-[440px]">{children}</div></div>
    </div>
  )
}

function StatusCard({ icon: Icon, title, description }: { icon: typeof AlertCircle; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-muted"><Icon className="size-7 text-muted-foreground" /></div>
      <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <Link href="/login" className="mt-6 inline-flex text-sm font-medium text-primary hover:underline">Giriş sayfasına git</Link>
    </div>
  )
}

export default async function SalesAdvisorInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invite = await prisma.salesAdvisorInvite.findUnique({
    where: { tokenHash: hashSalesAdvisorInviteToken(token) },
  })

  if (!invite || invite.status === "revoked") {
    return <InviteShell><StatusCard icon={AlertCircle} title="Geçersiz davet" description="Bu bağlantı geçerli değil veya yenisiyle değiştirilmiş." /></InviteShell>
  }
  if (invite.status === "accepted") {
    return <InviteShell><StatusCard icon={CheckCircle2} title="Davet kullanılmış" description="Bu bağlantı daha önce kullanılmış. Hesabınızla giriş yapabilirsiniz." /></InviteShell>
  }
  if (isSalesAdvisorInviteExpired(invite.expiresAt)) {
    return <InviteShell><StatusCard icon={Clock} title="Davetin süresi dolmuş" description="Kurucudan yeni bir satış danışmanı daveti isteyin." /></InviteShell>
  }

  return (
    <InviteShell>
      <SalesAdvisorAcceptForm token={token} name={`${invite.firstName} ${invite.lastName}`} email={invite.email} />
    </InviteShell>
  )
}
