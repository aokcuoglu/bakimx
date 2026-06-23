import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import { ReminderList } from "@/components/app/reminder-list"
import { getRemindersList } from "@/lib/reminders/queries"
import { prisma } from "@/lib/db"

export default async function RemindersPage() {
  const { user, workshop } = await getAppData()

  const reminders = await getRemindersList(user.workshopId)

  const stats = await prisma.maintenanceReminder.groupBy({
    by: ["status"],
    where: { workshopId: user.workshopId },
    _count: true,
  })

  const statMap: Record<string, number> = {}
  for (const s of stats) {
    statMap[s.status] = s._count
  }

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Bakım Hatırlatmaları">
      <ReminderList
        initialReminders={reminders}
        stats={statMap}
      />
    </AppShell>
  )
}
