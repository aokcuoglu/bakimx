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
  KeyRound,
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
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_RANK, rolesUpTo } from "@/lib/roles"
import {
  inviteMemberAction,
  resendInviteAction,
  resetMemberPasswordAction,
  revokeInviteAction,
  updateMemberRoleAction,
  setMemberActiveAction,
  setMemberTechnicianAction,
} from "@/app/(app)/settings/team/actions"
import { AddLocalMemberForm } from "@/components/settings/add-local-member-form"
import {
  MemberCredentialsDialog,
  type IssuedCredentials,
} from "@/components/settings/member-credentials-dialog"
import { WorkshopEntryQR } from "@/components/settings/workshop-entry-qr"

/**
 * E-postasız yoldan açılabilen roller (BAK-37). `owner`/`manager` bilerek yok —
 * onlarda e-posta zorunlu, e-posta davetiyle gelirler.
 */
const LOCAL_MEMBER_ROLES: UserRole[] = ["usta", "cirak"]

export type TeamMember = {
  id: string
  /** E-postasız (kullanıcı adıyla açılmış) üyelerde NULL — BAK-40. */
  email: string | null
  username: string | null
  firstName: string | null
  lastName: string | null
  role: UserRole
  isActive: boolean
  /** BAK-39: Teknicyen kaydıyla eşleştirilmiş ise bu id'dir, yoksa null. */
  technicianId: string | null
}
export type PendingInvite = {
  id: string
  email: string
  role: UserRole
  expiresAt: string
}

// Sabit renk YOK — tema token'ları (bkz. proje UI kuralları). Rozet tonu
// yetkinin ağırlığını yansıtır: yönetici > müdür > usta > çırak > eski kayıt.
const ROLE_BADGE: Record<UserRole, string> = {
  owner: "bg-primary/10 text-primary border-primary/20",
  manager: "bg-primary/5 text-foreground border-primary/20",
  usta: "bg-success/10 text-success-strong border-success/20",
  cirak: "bg-warning/10 text-warning-strong border-warning/20",
  staff: "bg-muted text-muted-foreground border-border",
}

/** Kimlik satırı: e-posta yoksa kullanıcı adı gösterilir, kutu boş kalmaz. */
function memberIdentity(m: TeamMember) {
  return m.email ?? m.username ?? "—"
}

/**
 * Şifresi panelden sıfırlanabilen üye: e-postası olmayan, kullanıcı adıyla giren
 * hesap. E-postası olan üye "şifremi unuttum" akışını kullanır — panelden şifre
 * üretmek, o hesabı sahibine haber vermeden devralmanın kısa yolu olurdu.
 */
function isLocalMember(m: TeamMember) {
  return !m.email && Boolean(m.username)
}

function memberName(m: TeamMember) {
  const n = `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim()
  return n || memberIdentity(m)
}

export function TeamManagement({
  members,
  invites,
  currentUserId,
  currentUserRole,
  canManage,
  seatUsed,
  seatLimit,
  workshopName,
  loginCode,
  technicians,
  logoUrl,
}: {
  members: TeamMember[]
  invites: PendingInvite[]
  currentUserId: string
  currentUserRole: UserRole
  canManage: boolean
  seatUsed: number
  seatLimit: number
  workshopName: string
  /** `Workshop.loginCode` — kullanıcı adıyla girişte hangi tenant olduğunu çözer. */
  loginCode: string
  /** BAK-39: Teknicyen listesi; üye seçimiyle eşleştirilmesi için. */
  technicians: { id: string; fullName: string; isActive: boolean }[]
  logoUrl?: string
}) {
  const atLimit = seatUsed >= seatLimit
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [showInvite, setShowInvite] = useState(false)
  const [showAddLocal, setShowAddLocal] = useState(false)
  /** Dolu olduğu sürece geçici şifre penceresi açık kalır — kapanınca kaybolur. */
  const [issued, setIssued] = useState<IssuedCredentials | null>(null)
  const [inviteEmail, setInviteEmail] = useState("")
  // Varsayılan "staff" idi; #183'te bu rol LEGACY oldu ve atanabilir listesinden
  // çıkarıldı. Varsayılan güncellenmediği için davet formu, seçenekler arasında
  // BULUNMAYAN "Personel (eski)" ile açılıyor ve dokunulmazsa yeni kullanıcı eski
  // role düşüyordu. Yeni davetin makul tabanı: Usta.
  const [inviteRole, setInviteRole] = useState<UserRole>("usta")
  const [lastInviteUrl, setLastInviteUrl] = useState("")
  const [copied, setCopied] = useState(false)

  // BAK-39: Teknicyen seçimi için label ve seçim haritası
  const technicianLabels = technicians.reduce(
    (acc, t) => ({ ...acc, [t.id]: t.fullName }),
    {} as Record<string, string>
  )

  const assignable = rolesUpTo(currentUserRole)
  // Rol atama kuralı korunur: kimse kendinden yüksek rol açamaz.
  const localAssignable = LOCAL_MEMBER_ROLES.filter((r) => assignable.includes(r))

  type ActionResult = {
    ok: boolean
    error?: string
    inviteUrl?: string
    credentials?: IssuedCredentials
  }

  function run(fn: () => Promise<ActionResult>, onOk?: (r: ActionResult) => void) {
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
    <div className="space-y-5">
      <WorkshopEntryQR workshopName={workshopName} loginCode={loginCode} logoUrl={logoUrl} />
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="size-5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-foreground">Ekip</h3>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                  // Sabit renk yerine tema token'ı (proje UI kuralı); açık zeminde
                  // metin AA geçsin diye warning'in -strong tonu.
                  atLimit ? "bg-warning/15 text-warning-strong" : "bg-muted text-muted-foreground"
                )}
              >
                {seatUsed} / {seatLimit} koltuk
              </span>
            </div>
            {/* Aşağıdaki "Teknisyenler & Ustalar" kartıyla karışıyordu: iki listede
                de "Usta" ve "Yönetici" geçiyor. Metin, hangisinin YETKİ verdiğini
                söylemek zorunda (#274). */}
            <p className="text-xs text-muted-foreground">
              Uygulamaya giriş yapan kullanıcılar. Rol, kişinin uygulamada neyi yapabileceğini belirler.
            </p>
          </div>
        </div>
        {canManage && (
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            {/* İki yol yan yana: e-postası olan davetle, olmayan geçici şifreyle gelir. */}
            {localAssignable.length > 0 && (
              <Button
                size="lg"
                onClick={() => {
                  setShowAddLocal((s) => !s)
                  setShowInvite(false)
                }}
                className="touch-manipulation"
              >
                <UserPlus className="size-4" />
                Kullanıcı Ekle
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                setShowInvite((s) => !s)
                setShowAddLocal(false)
              }}
              className="touch-manipulation"
            >
              <Mail className="size-4" />
              Davet Et
            </Button>
          </div>
        )}
      </div>

      {canManage && atLimit && (
        <div className="mb-4 p-3 rounded-lg border border-warning/20 bg-warning/10 text-sm text-warning-strong">
          Koltuk limitiniz dolu ({seatUsed}/{seatLimit}).
          {seatLimit <= 1
            ? " Paketiniz tek kullanıcı içeriyor — ekibinize kullanıcı eklemek için "
            : " Yeni kullanıcı eklemek ya da davet etmek için "}
          <Link href="/billing" className="font-semibold underline underline-offset-2">
            paketinizi yükseltin
          </Link>{" "}
          ya da ek koltuk için bizimle iletişime geçin.
        </div>
      )}

      {error && (
        <div className="mb-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive-strong text-sm">
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
              {copied ? <Check className="size-3.5 text-success-strong" /> : <Copy className="size-3.5" />}
              {copied ? "Kopyalandı" : "Kopyala"}
            </Button>
          </div>
        </div>
      )}

      {showAddLocal && canManage && localAssignable.length > 0 && (
        <AddLocalMemberForm
          assignableRoles={localAssignable}
          onCancel={() => setShowAddLocal(false)}
          onCreated={(credentials) => {
            setShowAddLocal(false)
            setIssued(credentials)
            router.refresh()
          }}
        />
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
                setInviteRole("usta")
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
            <Select items={ROLE_LABELS} value={inviteRole} onValueChange={(v) => v && setInviteRole(v as UserRole)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assignable.map((r) => (
                  <SelectItem key={r} value={r}>
                    <span className="flex flex-col items-start">
                      <span>{ROLE_LABELS[r]}</span>
                      <span className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</span>
                    </span>
                  </SelectItem>
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
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{memberIdentity(m)}</p>
                </div>
              </div>

              {manageable && (
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <Select
                    items={ROLE_LABELS}
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
                  {/* BAK-39: Teknicyen seçimi — kullanıcı bir teknicyen kaydıyla
                      eşleştirilirse, panelde kendi işlerini görecek. */}
                  {technicians.length > 0 && (
                    <Select
                      items={technicianLabels}
                      value={m.technicianId || ""}
                      disabled={isPending}
                      onValueChange={(v) => run(() => setMemberTechnicianAction(m.id, v || null))}
                    >
                      <SelectTrigger size="sm" className="text-xs">
                        <SelectValue placeholder="Teknisyen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Bağlantı yok</SelectItem>
                        {technicians.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.fullName} {!t.isActive && "(Pasif)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {/* E-postasız üyenin "şifremi unuttum" yolu yok — sıfırlama
                      buradan geçer ve yeni geçici şifre üretir. */}
                  {isLocalMember(m) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        run(
                          () => resetMemberPasswordAction(m.id),
                          (r) => r.credentials && setIssued(r.credentials)
                        )
                      }
                      disabled={isPending}
                      className="touch-manipulation"
                    >
                      <KeyRound className="size-3.5" /> Şifre Sıfırla
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => run(() => setMemberActiveAction(m.id, !m.isActive))}
                    disabled={isPending}
                    className={cn(
                      "touch-manipulation",
                      m.isActive
                        ? "text-destructive-strong hover:bg-destructive/10 border-destructive/20"
                        : "text-success-strong hover:bg-success/10 border-success/20"
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

        {/* Geçici şifre YALNIZ burada görünür; pencere kapanınca geri getirilemez. */}
        <MemberCredentialsDialog
          credentials={issued}
          workshopName={workshopName}
          loginCode={loginCode}
          onClose={() => setIssued(null)}
        />
      </div>
    </div>
  )
}
