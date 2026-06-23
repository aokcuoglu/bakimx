import type { Metadata } from "next"
import Link from "next/link"
import { AlertCircle, CheckCircle2, Clock } from "lucide-react"
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel"
import { SetPasswordForm } from "@/components/auth/set-password-form"
import { prisma } from "@/lib/db"
import { hashInviteToken, isInviteExpired } from "@/lib/invite"
import { ROLE_LABELS } from "@/lib/rbac"

export const metadata: Metadata = {
  title: "Ekip Daveti",
  description: "BakimX ekip davetinizi kabul edin.",
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-muted">
      <div className="lg:w-[45%] lg:min-h-screen p-0 lg:p-3">
        <div className="h-full lg:rounded-lg overflow-hidden shadow-2xl">
          <AuthVisualPanel />
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-[440px]">{children}</div>
      </div>
    </div>
  )
}

function StatusCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof AlertCircle
  title: string
  description: string
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
        <Icon className="size-7 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-bold text-foreground tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <Link
        href="/login"
        className="mt-6 inline-flex items-center text-sm text-primary hover:underline font-medium"
      >
        Giriş sayfasına git
      </Link>
    </div>
  )
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const invite = await prisma.invite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: { workshop: { select: { name: true } } },
  })

  if (!invite || invite.status === "revoked") {
    return (
      <InviteShell>
        <StatusCard
          icon={AlertCircle}
          title="Geçersiz davet"
          description="Bu davet bağlantısı geçerli değil veya iptal edilmiş. Lütfen iş yerinizden yeni bir davet isteyin."
        />
      </InviteShell>
    )
  }

  if (invite.status === "accepted") {
    return (
      <InviteShell>
        <StatusCard
          icon={CheckCircle2}
          title="Davet zaten kabul edilmiş"
          description="Bu davet daha önce kullanılmış. Hesabınızla giriş yapabilirsiniz."
        />
      </InviteShell>
    )
  }

  if (isInviteExpired(invite.expiresAt)) {
    return (
      <InviteShell>
        <StatusCard
          icon={Clock}
          title="Davetin süresi dolmuş"
          description="Bu davet bağlantısının süresi doldu. Lütfen iş yerinizden yeni bir davet isteyin."
        />
      </InviteShell>
    )
  }

  return (
    <InviteShell>
      <SetPasswordForm
        token={token}
        email={invite.email}
        workshopName={invite.workshop.name}
        roleLabel={ROLE_LABELS[invite.role]}
      />
    </InviteShell>
  )
}
