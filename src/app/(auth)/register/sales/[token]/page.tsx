import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { AlertCircle, CheckCircle2, Clock3 } from "lucide-react"
import { RegisterClient } from "@/components/auth/register-client"
import { Button } from "@/components/ui/button"
import { isAuthenticated } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  hashSalesRegistrationToken,
  salesRegistrationLinkState,
  type SalesRegistrationLinkState,
} from "@/lib/sales/registration-link"
import { salesAdvisorDisplayName } from "@/lib/sales/links"
import { PRIVATE_ROBOTS } from "@/lib/seo"

export const metadata: Metadata = {
  title: "BakımX Hesabınızı Oluşturun",
  description: "Satış danışmanınızın sizin için hazırladığı BakımX hesabını tamamlayın.",
  robots: PRIVATE_ROBOTS,
}

export const dynamic = "force-dynamic"

const STATUS_CONTENT: Record<Exclude<SalesRegistrationLinkState, "active"> | "invalid" | "changed", {
  icon: typeof AlertCircle
  title: string
  description: string
}> = {
  invalid: {
    icon: AlertCircle,
    title: "Geçersiz kayıt bağlantısı",
    description: "Bu bağlantı geçerli değil veya yenisiyle değiştirilmiş.",
  },
  revoked: {
    icon: AlertCircle,
    title: "Kayıt bağlantısı iptal edilmiş",
    description: "Satış danışmanınızdan güncel bağlantıyı isteyin.",
  },
  expired: {
    icon: Clock3,
    title: "Kayıt bağlantısının süresi dolmuş",
    description: "Satış danışmanınızdan yeni bir bağlantı oluşturmasını isteyin.",
  },
  used: {
    icon: CheckCircle2,
    title: "Kayıt bağlantısı kullanılmış",
    description: "Bu bağlantıyla hesap daha önce oluşturulmuş. E-postanızı doğruladıktan sonra giriş yapabilirsiniz.",
  },
  changed: {
    icon: AlertCircle,
    title: "Kayıt bağlantısı artık kullanılamıyor",
    description: "Aday veya danışman ataması değişti. Satış danışmanınızdan yeni bağlantı isteyin.",
  },
}

function StatusPage({ state }: { state: keyof typeof STATUS_CONTENT }) {
  const content = STATUS_CONTENT[state]
  const Icon = content.icon
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 text-center shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-muted">
          <Icon className="size-7 text-muted-foreground" />
        </div>
        <h1 className="mt-5 text-xl font-bold tracking-tight text-foreground">{content.title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{content.description}</p>
        <Button asChild className="mt-6"><Link href="/login">Giriş sayfasına git</Link></Button>
      </div>
    </div>
  )
}

function splitContactName(contactName: string): { firstName: string; lastName: string } {
  const parts = contactName.trim().split(/\s+/).filter(Boolean)
  return { firstName: parts.shift() ?? "", lastName: parts.join(" ") }
}

export default async function SalesRegistrationPage({ params }: { params: Promise<{ token: string }> }) {
  if (await isAuthenticated()) redirect("/dashboard")

  const { token } = await params
  const link = await prisma.salesRegistrationLink.findUnique({
    where: { tokenHash: hashSalesRegistrationToken(token) },
    select: {
      expiresAt: true,
      usedAt: true,
      revokedAt: true,
      advisorId: true,
      advisor: {
        select: {
          disabledAt: true,
          user: { select: { firstName: true, lastName: true, email: true, isActive: true } },
        },
      },
      lead: {
        select: {
          advisorId: true,
          status: true,
          workshopId: true,
          attributionFrozenAt: true,
          businessName: true,
          contactName: true,
          phone: true,
          email: true,
          city: true,
          district: true,
          address: true,
        },
      },
    },
  })
  if (!link) return <StatusPage state="invalid" />

  const state = salesRegistrationLinkState(link)
  if (state !== "active") return <StatusPage state={state} />
  if (
    link.advisor.disabledAt ||
    !link.advisor.user.isActive ||
    link.lead.advisorId !== link.advisorId ||
    link.lead.workshopId ||
    link.lead.attributionFrozenAt ||
    ["won", "lost"].includes(link.lead.status)
  ) {
    return <StatusPage state="changed" />
  }

  const owner = splitContactName(link.lead.contactName)
  return (
    <RegisterClient
      salesRegistration={{
        token,
        advisorName: salesAdvisorDisplayName(link.advisor.user) ?? "BakımX satış danışmanınız",
        workshopName: link.lead.businessName,
        phone: link.lead.phone,
        email: link.lead.email ?? "",
        city: link.lead.city ?? "",
        district: link.lead.district ?? "",
        address: link.lead.address ?? "",
        firstName: owner.firstName,
        lastName: owner.lastName,
      }}
    />
  )
}
