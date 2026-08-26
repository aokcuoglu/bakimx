"use client"

import { useState, useTransition } from "react"
import { Check, Copy, KeyRound, Loader2, MoreHorizontal, ShieldCheck, UserRoundCheck, UserRoundX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { UserRole } from "@prisma/client"
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/roles"
import { sendUserPasswordReset, setWorkshopUserActive, updateWorkshopUserRole } from "@/app/admin/actions"
import { toast } from "sonner"

/**
 * Destek müdahalesi (BAK-97): iş yeri detayında kullanıcı başına
 * "Şifre sıfırlama bağlantısı gönder".
 *
 * Bilerek hiçbir bağlantı GÖSTERMEZ — token yalnız kullanıcının kendi
 * e-postasına gider. Buton yalnız yetkili rollerde render edilir, ama sınır
 * sunucudadır: aksiyon her çağrıda yeteneği ve kullanıcının iş yerini
 * yeniden doğrular.
 */
export function SendPasswordResetButton({
  workshopId,
  userId,
  label,
}: {
  workshopId: string
  userId: string
  label: string
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  function send() {
    setError("")
    startTransition(async () => {
      const res = await sendUserPasswordReset(workshopId, userId)
      if (res.ok) setSent(true)
      else setError(res.error || "Gönderilemedi")
    })
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <Button
        size="sm"
        variant="outline"
        disabled={pending || sent}
        onClick={send}
        aria-label={`${label} için şifre sıfırlama bağlantısı gönder`}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : sent ? (
          <Check className="size-3.5" />
        ) : (
          <KeyRound className="size-3.5" />
        )}
        {sent ? "Gönderildi" : "Şifre bağlantısı"}
      </Button>
      {error && <span className="text-xs text-destructive-strong text-right">{error}</span>}
    </div>
  )
}

export function WorkshopUserActions({
  workshopId, user, canManage, canSendReset,
}: {
  workshopId: string
  user: { id: string; email: string | null; isActive: boolean; role: UserRole }
  canManage: boolean
  canSendReset: boolean
}) {
  const [pending, startTransition] = useTransition()
  const canReset = Boolean(canSendReset && user.email && user.isActive)
  const run = (work: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    startTransition(async () => {
      const result = await work()
      if (result.ok) toast.success(success)
      else toast.error(result.error ?? "İşlem tamamlanamadı.")
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Kullanıcı işlemleri" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Kullanıcı işlemleri</DropdownMenuLabel>
        <DropdownMenuItem disabled={!canReset} onSelect={() => run(() => sendUserPasswordReset(workshopId, user.id), "Şifre bağlantısı gönderildi")}>
          <KeyRound /> Şifre bağlantısı gönder
        </DropdownMenuItem>
        {user.email && <DropdownMenuItem onSelect={() => { navigator.clipboard.writeText(user.email!); toast.success("E-posta kopyalandı") }}><Copy /> E-postayı kopyala</DropdownMenuItem>}
        <DropdownMenuSeparator />
        {canManage && <><DropdownMenuSub>
          <DropdownMenuSubTrigger><ShieldCheck /> Rolü değiştir</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            {ASSIGNABLE_ROLES.map((role) => <DropdownMenuItem key={role} disabled={role === user.role} onSelect={() => run(() => updateWorkshopUserRole(workshopId, user.id, role), `Rol “${ROLE_LABELS[role]}” olarak güncellendi`)}>{ROLE_LABELS[role]}</DropdownMenuItem>)}
          </DropdownMenuSubContent>
        </DropdownMenuSub><DropdownMenuSeparator />
        <DropdownMenuItem variant={user.isActive ? "destructive" : "default"} onSelect={() => run(() => setWorkshopUserActive(workshopId, user.id, !user.isActive), user.isActive ? "Kullanıcı pasifleştirildi" : "Kullanıcı etkinleştirildi")}>
          {user.isActive ? <UserRoundX /> : <UserRoundCheck />}{user.isActive ? "Kullanıcıyı pasifleştir" : "Kullanıcıyı etkinleştir"}
        </DropdownMenuItem></>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
