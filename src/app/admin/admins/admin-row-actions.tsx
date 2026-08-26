"use client"

import { useState, useTransition } from "react"
import { Loader2, LogOut, Power } from "lucide-react"
import { toast } from "sonner"
import type { AdminRole } from "@/lib/admin-roles"
import { ADMIN_ROLES, ADMIN_ROLE_DESCRIPTIONS, ADMIN_ROLE_LABELS } from "@/lib/admin-roles"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  changePlatformAdminRole,
  revokePlatformAdminSessions,
  setPlatformAdminDisabled,
} from "@/app/admin/admins/actions"

export interface PlatformAdminRowData {
  id: string
  role: AdminRole
  disabled: boolean
  email: string
  name: string
  workshopName: string
  userActive: boolean
  isSelf: boolean
  createdAtLabel: string
  createdByEmail: string | null
  sessionsValidFromLabel: string | null
}

/**
 * Bir yönetici satırı + işlemleri (rol değiştir · erişimi kapat/aç · oturumları kapat).
 *
 * Sunucu her action'da yetkiyi yeniden doğrular; buradaki `disabled` durumları
 * yalnız UX içindir, güvenlik sınırı değildir.
 */
export function PlatformAdminRow({ admin }: { admin: PlatformAdminRowData }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, successMessage: string) {
    setError("")
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) {
        const message = res.error || "İşlem başarısız"
        setError(message)
        toast.error(message)
      } else {
        toast.success(successMessage)
      }
    })
  }

  return (
    <tr className="border-b last:border-0 align-top">
      <td className="px-3 py-2">
        <div className="font-medium text-foreground">{admin.email}</div>
        <div className="text-xs text-muted-foreground">
          {admin.name && <span>{admin.name} · </span>}
          {admin.workshopName}
          {admin.isSelf && <span className="text-primary"> · siz</span>}
        </div>
        {error && <p className="mt-1 text-sm text-destructive-strong">{error}</p>}
      </td>

      <td className="px-3 py-2">
        <Select
          value={admin.role}
          onValueChange={(v) => v && v !== admin.role && run(() => changePlatformAdminRole(admin.id, v), "Yönetici rolü güncellendi")}
          disabled={pending}
        >
          <SelectTrigger className="w-40" aria-label={`${admin.email} rolü`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ADMIN_ROLES.map((r) => (
              <SelectItem key={r} value={r} description={ADMIN_ROLE_DESCRIPTIONS[r]}>
                {ADMIN_ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          <Badge variant={admin.disabled ? "secondary" : "default"}>
            {admin.disabled ? "devre dışı" : "aktif"}
          </Badge>
          {!admin.userActive && (
            <span className="text-xs text-warning-strong">hesap pasif</span>
          )}
          {admin.sessionsValidFromLabel && (
            <span className="text-xs text-muted-foreground">
              oturumlar {admin.sessionsValidFromLabel} sonrası geçerli
            </span>
          )}
        </div>
      </td>

      <td className="px-3 py-2 text-muted-foreground">
        <div>{admin.createdAtLabel}</div>
        {admin.createdByEmail && (
          <div className="text-xs">ekleyen: {admin.createdByEmail}</div>
        )}
      </td>

      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => setPlatformAdminDisabled(admin.id, !admin.disabled), admin.disabled ? "Yönetici erişimi açıldı" : "Yönetici erişimi kapatıldı")}
          >
            <Power className="size-3.5" />
            {admin.disabled ? "Erişimi aç" : "Erişimi kapat"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || admin.disabled}
            onClick={() => run(() => revokePlatformAdminSessions(admin.id), "Yönetici oturumları kapatıldı")}
          >
            <LogOut className="size-3.5" />
            Oturumları kapat
          </Button>
        </div>
      </td>
    </tr>
  )
}
