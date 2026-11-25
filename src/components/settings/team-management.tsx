"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import {
  Users,
  UserPlus,
  Mail,
  Search,
  MoreHorizontal,
  Copy,
  Check,
  KeyRound,
  Loader2,
  RotateCw,
  X,
  TriangleAlert,
} from "lucide-react"
import type { UserRole } from "@prisma/client"
import { PLAN_LABELS, PLAN_SEATS, type PlanTier } from "@/lib/plan"
import { trackMarketingEvent } from "@/lib/marketing-analytics"
import { getSupportWhatsAppUrl } from "@/lib/support-whatsapp"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_RANK, rolesUpTo } from "@/lib/roles"
import { typedResolver } from "@/lib/validations/resolver"
import { inviteMemberSchema, type InviteMemberFormValues } from "@/lib/validations/settings"
import {
  inviteMemberAction,
  resendInviteAction,
  resetMemberPasswordAction,
  revokeInviteAction,
  assignMemberTeamAction,
  updateMemberRoleAction,
  setMemberActiveAction,
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
  teamId?: string | null
  teamName?: string | null
}
export type PendingInvite = {
  id: string
  email: string
  role: UserRole
  expiresAt: string
}
export type AccountMissingPersonnel = {
  id: string
  fullName: string
  role: string
  isActive: boolean
}

// Sabit renk YOK — tema token'ları (bkz. proje UI kuralları). Rozet tonu
// yetkinin ağırlığını yansıtır: yönetici > müdür > usta > çırak > eski kayıt.
const ROLE_BADGE: Record<UserRole, string> = {
  owner: "bg-primary/10 text-primary-strong border-primary/20",
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
  teams = [],
  invites,
  currentUserId,
  currentUserRole,
  canManage,
  initialInviteOpen = false,
  seatUsed,
  seatLimit,
  accessTier,
  workshopName,
  loginCode,
  accountMissingPersonnel,
  logoUrl,
}: {
  members: TeamMember[]
  teams?: { id: string; name: string }[]
  invites: PendingInvite[]
  currentUserId: string
  currentUserRole: UserRole
  canManage: boolean
  initialInviteOpen?: boolean
  seatUsed: number
  seatLimit: number
  accessTier: PlanTier
  workshopName: string
  /** `Workshop.loginCode` — kullanıcı adıyla girişte hangi tenant olduğunu çözer. */
  loginCode: string
  /** Migration'ın sessizce hesap uyduramadığı eski personel kayıtları. */
  accountMissingPersonnel: AccountMissingPersonnel[]
  logoUrl?: string
}) {
  const atLimit = seatUsed >= seatLimit
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [showInvite, setShowInvite] = useState(canManage && initialInviteOpen)
  const [showAddLocal, setShowAddLocal] = useState(false)
  const [accountMissingId, setAccountMissingId] = useState<string | null>(null)
  /** Dolu olduğu sürece geçici şifre penceresi açık kalır — kapanınca kaybolur. */
  const [issued, setIssued] = useState<IssuedCredentials | null>(null)
  const [lastInviteUrl, setLastInviteUrl] = useState("")
  const [copied, setCopied] = useState(false)
  const [query, setQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("")

  // Varsayılan "staff" idi; #183'te bu rol LEGACY oldu ve atanabilir listesinden
  // çıkarıldı. Varsayılan güncellenmediği için davet formu, seçenekler arasında
  // BULUNMAYAN "Personel (eski)" ile açılıyor ve dokunulmazsa yeni kullanıcı eski
  // role düşüyordu. Yeni davetin makul tabanı: Usta.
  const inviteForm = useForm<InviteMemberFormValues, unknown, InviteMemberFormValues>({
    resolver: typedResolver(inviteMemberSchema),
    defaultValues: { email: "", role: "usta" },
  })

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
      <div>

      {canManage && atLimit && (
        <div className="mb-4 p-3 rounded-lg border border-warning/20 bg-warning/10 text-sm text-warning-strong">
          Koltuk limitiniz dolu ({seatUsed}/{seatLimit}).
          {seatLimit <= 1 ? (
            <>
              {" "}Paketiniz tek kullanıcı içeriyor — ekibinize kullanıcı eklemek için{" "}
              <Link href="/settings/plans" onClick={() => trackMarketingEvent("feature_upgrade_clicked", { feature_id: "team", current_tier: accessTier, kind: "package", placement: "inline", destination: "plans" })} className="font-semibold underline underline-offset-2">
                {PLAN_SEATS.pro} kullanıcılı {PLAN_LABELS.pro}&apos;ni inceleyin
              </Link>
              .
            </>
          ) : (
            <>
              {" "}Ek kullanıcı için{" "}
              <Link
                href={getSupportWhatsAppUrl(`Merhaba, BakımX hesabımıza ek kullanıcı eklemek istiyoruz.${workshopName ? ` (${workshopName})` : ""}`)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackMarketingEvent("feature_upgrade_clicked", { feature_id: "team", current_tier: accessTier, kind: "package", placement: "inline", destination: "contact" })}
                className="font-semibold underline underline-offset-2"
              >
                bizimle iletişime geçin
              </Link>
              .
            </>
          )}
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {lastInviteUrl && (
        <div className="mb-4 p-3 rounded-lg border border-primary/20 bg-primary/5 text-sm">
          <p className="font-medium text-foreground mb-1.5">Davet oluşturuldu 🎉</p>
          <p className="text-muted-foreground text-xs mb-2">
            Davet bağlantısını kişiye iletin (e-posta da gönderildi). 7 gün geçerlidir.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate text-xs bg-card border rounded px-2 py-1.5">{lastInviteUrl}</code>
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

      <Dialog
        open={showAddLocal && canManage && localAssignable.length > 0}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddLocal(false)
            setAccountMissingId(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {accountMissingId ? "Personelin giriş hesabını tamamla" : "Kullanıcı ekle"}
            </DialogTitle>
          </DialogHeader>
          <AddLocalMemberForm
            key={accountMissingId ?? "new"}
            assignableRoles={localAssignable}
            onCancel={() => {
              setShowAddLocal(false)
              setAccountMissingId(null)
            }}
            technicianId={accountMissingId ?? undefined}
            initialFullName={
              accountMissingPersonnel.find((person) => person.id === accountMissingId)?.fullName
            }
            onCreated={(credentials) => {
              setShowAddLocal(false)
              setAccountMissingId(null)
              setIssued(credentials)
              router.refresh()
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showInvite && canManage} onOpenChange={(open) => !open && setShowInvite(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ekip üyesi davet et</DialogTitle>
          </DialogHeader>
        <Form {...inviteForm}>
          <form
            onSubmit={inviteForm.handleSubmit((values) => {
              const fd = new FormData()
              fd.set("email", values.email)
              fd.set("role", values.role)
              run(
                () => inviteMemberAction(fd),
                (r) => {
                  setLastInviteUrl(r.inviteUrl || "")
                  inviteForm.reset({ email: "", role: "usta" })
                  setShowInvite(false)
                }
              )
            })}
            className="space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                control={inviteForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-posta</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="ornek@atolye.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={inviteForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {assignable.map((r) => (
                            <SelectItem key={r} value={r} description={ROLE_DESCRIPTIONS[r]}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="foreground"
                type="submit"
                size="lg"
                disabled={isPending}
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
        </Form>
        </DialogContent>
      </Dialog>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ad veya e-posta ara"
            className="pl-8"
          />
        </div>
        <Select value={roleFilter || "all"} onValueChange={(value) => setRoleFilter(value === "all" ? "" : value as UserRole)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Filtre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm roller</SelectItem>
            {assignable.map((role) => (
              <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canManage ? (
          <div className="flex gap-2">
            {localAssignable.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAccountMissingId(null)
                  setShowInvite(false)
                  setShowAddLocal(true)
                }}
              >
                <UserPlus className="size-3.5" />
                Kullanıcı ekle
              </Button>
            ) : null}
            <Button
              type="button"
              variant="foreground"
              onClick={() => {
                setShowAddLocal(false)
                setAccountMissingId(null)
                setShowInvite(true)
              }}
            >
              <Mail className="size-3.5" />
              Davet et
            </Button>
          </div>
        ) : null}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{seatUsed} / {seatLimit} koltuk</p>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-[1fr_8rem_8rem_2.5rem] items-center gap-3 border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Users className="size-3.5" /> Kullanıcı</span>
          <span>Rol</span>
          <span>Ekip</span>
          <span />
        </div>
        {members.filter((member) => {
          const needle = query.trim().toLocaleLowerCase("tr")
          const haystack = `${memberName(member)} ${memberIdentity(member)}`.toLocaleLowerCase("tr")
          if (needle && !haystack.includes(needle)) return false
          if (roleFilter && member.role !== roleFilter) return false
          return true
        }).map((m) => {
          const manageable = canManageMember(m)
          const isSelf = m.id === currentUserId
          const initial = memberName(m).slice(0, 1).toLocaleUpperCase("tr")
          return (
            <div
              key={m.id}
              className={cn(
                "grid grid-cols-[1fr_8rem_8rem_2.5rem] items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0",
                m.isActive ? "bg-card" : "bg-muted",
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-warning/15 text-[11px] font-semibold text-warning-strong">
                  {initial}
                </span>
                <span className={cn("truncate text-sm font-medium", m.isActive ? "text-foreground" : "text-muted-foreground")}>
                  {memberName(m)}
                  {isSelf ? <span className="ml-1 font-normal text-muted-foreground">(Siz)</span> : null}
                </span>
                <span className="hidden truncate text-sm text-muted-foreground sm:inline">{memberIdentity(m)}</span>
                {!m.isActive ? <span className="text-[10px] text-muted-foreground">Pasif</span> : null}
              </div>
              <span className={cn("inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px] font-medium border", ROLE_BADGE[m.role])}>
                {ROLE_LABELS[m.role]}
              </span>
              <span className="truncate text-sm text-foreground">{m.teamName ?? "—"}</span>
              {manageable ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="Üye işlemleri">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Rol</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {assignable.map((role) => (
                          <DropdownMenuItem key={role} onClick={() => run(() => updateMemberRoleAction(m.id, role))}>
                            {ROLE_LABELS[role]}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    {teams.length > 0 && m.role !== "owner" ? (
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Ekip</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {teams.map((team) => (
                            <DropdownMenuItem key={team.id} onClick={() => run(() => assignMemberTeamAction(m.id, team.id))}>
                              {team.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    ) : null}
                    <DropdownMenuSeparator />
                    {isLocalMember(m) ? (
                      <DropdownMenuItem
                        onClick={() =>
                          run(
                            () => resetMemberPasswordAction(m.id),
                            (result) => result.credentials && setIssued(result.credentials),
                          )
                        }
                      >
                        <KeyRound className="size-3.5" /> Şifre sıfırla
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem onClick={() => run(() => setMemberActiveAction(m.id, !m.isActive))}>
                      {m.isActive ? "Pasif yap" : "Aktif yap"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : <span />}
            </div>
          )
        })}
      </div>

      {accountMissingPersonnel.length > 0 && (
        <div className="mt-5 space-y-2" aria-label="Hesabı eksik personel">
          <h4 className="text-sm font-semibold text-foreground">Hesabı tamamlanacak personel</h4>
          {accountMissingPersonnel.map((person) => (
            <div
              key={person.id}
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-warning/20 bg-warning/10 p-3"
            >
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning-strong" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{person.fullName}</p>
                <p className="text-xs text-warning-strong">
                  Bu eski personel kaydının giriş hesabı yok. Yanlış kişiye iş geçmişi bağlanmaması için otomatik eşleştirilmedi.
                </p>
                {canManage && localAssignable.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      setAccountMissingId(person.id)
                      setShowAddLocal(true)
                      setShowInvite(false)
                    }}
                  >
                    Giriş hesabını tamamla
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
