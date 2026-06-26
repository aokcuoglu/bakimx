"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Users,
  UserPlus,
  Mail,
  Copy,
  Check,
  Loader2,
  RotateCw,
  X,
  ShieldCheck,
} from "lucide-react"
import type { UserRole } from "@prisma/client"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROLE_LABELS, ROLE_RANK, rolesUpTo } from "@/lib/roles"
import {
  inviteMemberAction,
  resendInviteAction,
  revokeInviteAction,
  updateMemberRoleAction,
  setMemberActiveAction,
} from "@/app/(app)/settings/team/actions"

export type TeamMember = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: UserRole
  isActive: boolean
}
export type PendingInvite = {
  id: string
  email: string
  role: UserRole
  expiresAt: string
}

const ROLE_BADGE: Record<UserRole, string> = {
  owner: "bg-primary/10 text-primary border-primary/20",
  manager: "bg-blue-100 text-blue-800 border-blue-200",
  staff: "bg-muted text-muted-foreground border-border",
}

function memberName(m: TeamMember) {
  const n = `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim()
  return n || m.email
}

export function TeamManagement({
  members,
  invites,
  currentUserId,
  currentUserRole,
  canManage,
  seatUsed,
  seatLimit,
}: {
  members: TeamMember[]
  invites: PendingInvite[]
  currentUserId: string
  currentUserRole: UserRole
  canManage: boolean
  seatUsed: number
  seatLimit: number
}) {
  const atLimit = seatUsed >= seatLimit
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<UserRole>("staff")
  const [lastInviteUrl, setLastInviteUrl] = useState("")
  const [copied, setCopied] = useState(false)

  const assignable = rolesUpTo(currentUserRole)

  function run(fn: () => Promise<{ ok: boolean; error?: string; inviteUrl?: string }>, onOk?: (r: { inviteUrl?: string }) => void) {
    setError("")
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) {
        setError(res.error || "İşlem başarısız")
      } else {
        onOk?.(res)
        router.refresh()
      }
    })
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function canManageMember(m: TeamMember) {
    return canManage && m.id !== currentUserId && ROLE_RANK[m.role] <= ROLE_RANK[currentUserRole]
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Users className="size-5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-foreground">Ekip</h3>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                  atLimit ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"
                )}
              >
                {seatUsed} / {seatLimit} koltuk
              </span>
            </div>
            <p className="text-xs text-muted-foreground">İş yerinizin kullanıcılarını ve yetkilerini yönetin</p>
          </div>
        </div>
        {canManage && (
          <Button
            size="lg"
            onClick={() => setShowInvite((s) => !s)}
            className="shrink-0 touch-manipulation"
          >
            <UserPlus className="size-4" />
            Davet Et
          </Button>
        )}
      </div>

      {canManage && atLimit && (
        <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-900">
          Koltuk limitiniz dolu ({seatUsed}/{seatLimit}). Yeni kullanıcı davet etmek için{" "}
          <Link href="/billing" className="font-semibold underline underline-offset-2">
            paketinizi yükseltin
          </Link>{" "}
          ya da ek koltuk için bizimle iletişime geçin.
        </div>
      )}

      {error && (
        <div className="mb-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      {lastInviteUrl && (
        <div className="mb-4 p-3 rounded-lg border border-primary/20 bg-primary/5 text-sm">
          <p className="font-medium text-foreground mb-1.5">Davet oluşturuldu 🎉</p>
          <p className="text-muted-foreground text-xs mb-2">
            Davet bağlantısını kişiye iletin (e-posta da gönderildi). 7 gün geçerlidir.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate text-xs bg-white border rounded px-2 py-1.5">{lastInviteUrl}</code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copy(lastInviteUrl)}
              className="shrink-0"
            >
              {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
              {copied ? "Kopyalandı" : "Kopyala"}
            </Button>
          </div>
        </div>
      )}

      {showInvite && canManage && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData()
            fd.set("email", inviteEmail)
            fd.set("role", inviteRole)
            run(
              () => inviteMemberAction(fd),
              (r) => {
                setLastInviteUrl(r.inviteUrl || "")
                setInviteEmail("")
                setInviteRole("staff")
                setShowInvite(false)
              }
            )
          }}
          className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-3 mb-4"
        >
          <h4 className="text-sm font-semibold text-foreground">Ekip üyesi davet et</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="E-posta *"
              required
            />
            <Select value={inviteRole} onValueChange={(v) => v && setInviteRole(v as UserRole)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assignable.map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              size="lg"
              disabled={isPending || !inviteEmail.trim()}
              className="touch-manipulation"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
              Davet Gönder
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setShowInvite(false)}
              className="touch-manipulation"
            >
              İptal
            </Button>
          </div>
        </form>
      )}

      {/* Members */}
      <div className="space-y-2">
        {members.map((m) => {
          const manageable = canManageMember(m)
          const isSelf = m.id === currentUserId
          return (
            <div
              key={m.id}
              className={cn(
                "flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border",
                m.isActive ? "border-border bg-white" : "border-border bg-muted opacity-60"
              )}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                  <ShieldCheck className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-sm font-medium truncate", m.isActive ? "text-foreground" : "text-muted-foreground")}>
                      {memberName(m)}
                    </span>
                    {isSelf && <span className="text-[10px] text-muted-foreground">(Siz)</span>}
                    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border", ROLE_BADGE[m.role])}>
                      {ROLE_LABELS[m.role]}
                    </span>
                    {!m.isActive && (
                      <span className="text-[10px] font-medium text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded">Pasif</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{m.email}</p>
                </div>
              </div>

              {manageable && (
                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={m.role}
                    disabled={isPending}
                    onValueChange={(v) => v && run(() => updateMemberRoleAction(m.id, v))}
                  >
                    <SelectTrigger size="sm" className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {assignable.map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => run(() => setMemberActiveAction(m.id, !m.isActive))}
                    disabled={isPending}
                    className={cn(
                      "touch-manipulation",
                      m.isActive
                        ? "text-destructive hover:bg-destructive/10 border-destructive/20"
                        : "text-success hover:bg-success/10 border-success/20"
                    )}
                  >
                    {m.isActive ? "Pasif Yap" : "Aktif Yap"}
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-foreground mb-2">Bekleyen davetler</h4>
          <div className="space-y-2">
            {invites.map((inv) => (
              <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border border-dashed border-border bg-muted/30">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Mail className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground truncate">{inv.email}</span>
                  <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border", ROLE_BADGE[inv.role])}>
                    {ROLE_LABELS[inv.role]}
                  </span>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => run(() => resendInviteAction(inv.id), (r) => setLastInviteUrl(r.inviteUrl || ""))}
                      disabled={isPending}
                    >
                      <RotateCw className="size-3.5" /> Yeniden gönder
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => run(() => revokeInviteAction(inv.id))}
                      disabled={isPending}
                    >
                      <X className="size-3.5" /> İptal
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
