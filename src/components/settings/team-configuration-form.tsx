"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PERMISSION_GROUPS, PERMISSION_LABELS, type Permission } from "@/lib/roles"
import {
  deleteWorkshopTeamAction,
  saveWorkshopTeamAction,
} from "@/app/(app)/settings/members-and-teams/teams/actions"

export function TeamConfigurationForm({
  team,
  canManage,
}: {
  team: { id: string; name: string; description: string | null; permissions: Permission[] }
  canManage: boolean
}) {
  const router = useRouter()
  const [name, setName] = useState(team.name)
  const [description, setDescription] = useState(team.description ?? "")
  const [permissions, setPermissions] = useState<Permission[]>(team.permissions)
  const [pending, start] = useTransition()

  function toggle(permission: Permission, checked: boolean) {
    setPermissions((current) =>
      checked ? [...current, permission] : current.filter((item) => item !== permission),
    )
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Genel</h2>
          <p className="text-sm text-muted-foreground">Bu ekibin adını ve açıklamasını belirleyin.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="team-name" className="text-xs font-medium text-muted-foreground">Ekip adı</label>
            <Input id="team-name" value={name} disabled={!canManage} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="team-description" className="text-xs font-medium text-muted-foreground">Ekip açıklaması</label>
            <Input id="team-description" value={description} disabled={!canManage} onChange={(event) => setDescription(event.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Yetkiler</h2>
          <p className="text-sm text-muted-foreground">Bu ekibin üyeleri işaretli işleri yapabilir. Yönetici hesapları bu listenin dışındadır.</p>
        </div>
        {PERMISSION_GROUPS.map((group) => (
          <fieldset key={group.title} className="space-y-2 rounded-xl border border-border p-3">
            <legend className="px-1 text-xs font-medium text-muted-foreground">{group.title}</legend>
            {group.permissions.map((permission) => {
              const meta = PERMISSION_LABELS[permission]
              return (
                <label key={permission} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={permissions.includes(permission)}
                    disabled={!canManage}
                    onCheckedChange={(value) => toggle(permission, value === true)}
                  />
                  <span>
                    <span className="block text-foreground">{meta.label}</span>
                    <span className="block text-xs text-muted-foreground">{meta.hint}</span>
                  </span>
                </label>
              )
            })}
          </fieldset>
        ))}
        {canManage ? (
          <Button
            type="button"
            variant="foreground"
            disabled={pending}
            onClick={() => {
              start(async () => {
                const result = await saveWorkshopTeamAction({ id: team.id, name, description, permissions })
                if (!result.ok) {
                  toast.error(result.error)
                  return
                }
                toast.success("Ekip kaydedildi.")
                router.refresh()
              })
            }}
          >
            Kaydet
          </Button>
        ) : null}
      </section>

      {canManage ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Tehlikeli bölge</h2>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Ekibi sil</p>
              <p className="text-xs text-muted-foreground">Silinen ekip geri gelmez. Üyeler ekipsiz kalır ve statik rollerine döner.</p>
            </div>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                start(async () => {
                  const result = await deleteWorkshopTeamAction(team.id)
                  if (!result.ok) {
                    toast.error(result.error)
                    return
                  }
                  toast.success("Ekip silindi.")
                  router.push("/settings/members-and-teams/teams")
                })
              }}
            >
              <Trash2 className="size-3.5" />
              Ekibi sil
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
