import Link from "next/link"
import { Eye } from "lucide-react"
import { getActiveImpersonationSessions } from "@/lib/impersonation"
import { RevokeImpersonationButton } from "@/app/admin/revoke-impersonation-button"

/**
 * Açık taklit (impersonation) oturumları — konsolun en hassas yeteneğinin canlı
 * görünümü (BAK-96). Çağıran taraf `viewAudit` kapısını uygulamak zorundadır;
 * "İptal et" düğmesinin arkasındaki action ayrıca `impersonate` ister.
 *
 * Boş durumda da render edilir: "açık oturum yok" bilgisinin kendisi denetim
 * bilgisidir — bölümü gizlemek, hiç bakılmamış olmakla aynı görünürdü.
 */
function fmt(d: Date): string {
  return d.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })
}

function remainingLabel(expiresAt: Date): string {
  const minutes = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 60_000))
  return minutes === 0 ? "birazdan biter" : `${minutes} dk kaldı`
}

export async function ActiveImpersonations({ canRevoke }: { canRevoke: boolean }) {
  const sessions = await getActiveImpersonationSessions()

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-foreground">Açık taklit oturumları</h2>
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Açık taklit oturumu yok.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-warning/40 bg-warning/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warning/30 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Yönetici</th>
                <th className="px-3 py-2 font-medium">Kiracı</th>
                <th className="px-3 py-2 font-medium">Başlangıç</th>
                <th className="px-3 py-2 font-medium">Bitiş</th>
                <th className="px-3 py-2 font-medium">Gerekçe</th>
                {canRevoke && <th className="px-3 py-2 font-medium">İşlem</th>}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-warning/20 last:border-0 align-top">
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <Eye className="size-3.5 text-warning-strong" />
                      {s.adminEmail}
                    </span>
                    {s.targetEmail && (
                      <span className="text-xs text-muted-foreground">→ {s.targetEmail}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/workshops/${s.workshopId}`}
                      className="text-primary hover:underline"
                    >
                      {s.workshopName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {fmt(s.startedAt)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {fmt(s.expiresAt)}
                    <span className="block text-xs text-warning-strong">
                      {remainingLabel(s.expiresAt)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{s.reason ?? "—"}</td>
                  {canRevoke && (
                    <td className="px-3 py-2">
                      <RevokeImpersonationButton sessionId={s.id} label={s.workshopName} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
