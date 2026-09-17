import { AppShell } from "@/components/layout/app-shell"
import { SettingsPageHeader } from "@/components/settings/settings-page-header"
import { PdfTemplatesForm } from "@/components/settings/pdf-templates-form"
import { loadWorkshopSettings } from "../load-workshop-settings"

export const metadata = { title: "PDF" }

export default async function SettingsPdfTemplatesPage() {
  const { workshop, serializedSettings } = await loadWorkshopSettings()

  if (!workshop || !serializedSettings) {
    return (
      <AppShell wide>
        <div className="text-center py-12 text-muted-foreground">
          <p>İş yeri bilgisi bulunamadı</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell wide workshopName={workshop.name} pageTitle="PDF">
      <SettingsPageHeader
        title="PDF"
        description="İş emri, servis pasaportu ve makbuz şablonlarını yönetin."
      />
      <PdfTemplatesForm settings={serializedSettings} />
    </AppShell>
  )
}
