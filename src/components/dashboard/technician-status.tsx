import { TECHNICIAN_ROLES } from "@/lib/constants"
import { DashEmpty, DashPanel, DashPill, DashRow, DashTile, initials } from "@/components/dashboard/surface"

type TechnicianRow = {
  id: string
  fullName: string
  phone: string
  role: string
  activeJobs: number
  inProgressJobs: number
  delayedJobs: number
  completedToday: number
}

/** İş alan roller; yönetici ve danışman yalnız üzerinde iş varsa listelenir. */
const HANDS_ON_ROLES = new Set(["usta", "cirak", "teknisyen"])

/**
 * Ekibin iş yükü, en yüklüden boşta olana. Atanmamış işler burada değil,
 * "Dikkat gerektiren işler"de durur.
 */
export function TechnicianStatusWidget({ technicians }: { technicians: TechnicianRow[] }) {
  const rows = technicians
    .filter((t) => t.activeJobs > 0 || HANDS_ON_ROLES.has(t.role))
    .sort((a, b) => b.activeJobs - a.activeJobs || a.fullName.localeCompare(b.fullName, "tr"))

  return (
    <DashPanel title="Ekip" action={rows.length > 0 ? { href: "/technician", label: "Tümünü gör" } : undefined}>
      {rows.length === 0 ? (
        <DashEmpty>Henüz teknisyen kaydı yok. Ayarlar → Ekip sayfasından ekleyin.</DashEmpty>
      ) : (
        rows.map((t) => {
          const roleLabel = (TECHNICIAN_ROLES as Record<string, { label: string }>)[t.role]?.label || t.role
          const load = t.activeJobs > 0 ? `${t.activeJobs} aktif iş` : "Boşta"
          const parts = [roleLabel, load]
          if (t.inProgressJobs > 0) parts.push(`${t.inProgressJobs} işlemde`)
          return (
            <DashRow
              key={t.id}
              href={`/orders?technician=${t.id}`}
              start={<DashTile tone="info" circle>{initials(t.fullName)}</DashTile>}
              title={t.fullName}
              sub={parts.join(" · ")}
              end={t.delayedJobs > 0 ? <DashPill tone="warning">{t.delayedJobs} gecikmiş</DashPill> : undefined}
            />
          )
        })
      )}
    </DashPanel>
  )
}
