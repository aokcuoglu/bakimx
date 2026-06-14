import { getAppData } from "@/app/app/data"
import { getWorkshopSettings } from "./actions"
import { AppShell } from "@/components/app/app-shell"
import { SettingsTabs } from "./settings-tabs"

export const metadata = {
  title: "Ayarlar | BakimX",
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { user, workshop } = await getAppData()
  const params = await searchParams

  if (!workshop) {
    return (
      <AppShell>
        <div className="text-center py-12 text-muted-foreground">
          <p>İş yeri bilgisi bulunamadı</p>
        </div>
      </AppShell>
    )
  }

  const { settings } = await getWorkshopSettings()

  const serializedWorkshop = {
    id: workshop.id,
    name: workshop.name,
    phone: workshop.phone,
    city: workshop.city,
    district: workshop.district,
    address: workshop.address,
    email: workshop.email,
    website: workshop.website,
    logoUrl: workshop.logoUrl,
    taxNumber: workshop.taxNumber,
    taxOffice: workshop.taxOffice,
    invoiceTitle: workshop.invoiceTitle,
    createdAt: workshop.createdAt.toISOString(),
  }

  const serializedSettings = {
    pdfLogoUrl: settings.pdfLogoUrl,
    publicPortalLogoUrl: settings.publicPortalLogoUrl,
    passportLogoUrl: settings.passportLogoUrl,
    themeColor: settings.themeColor,
    accentColor: settings.accentColor,
    smsProvider: settings.smsProvider,
    smsSenderName: settings.smsSenderName,
    whatsappProvider: settings.whatsappProvider,
    whatsappPhoneNumber: settings.whatsappPhoneNumber,
    emailProvider: settings.emailProvider,
    emailFromAddress: settings.emailFromAddress,
    emailFromName: settings.emailFromName,
    weekdayStart: settings.weekdayStart,
    weekdayEnd: settings.weekdayEnd,
    weekdayWorkingDays: settings.weekdayWorkingDays,
    weekendStart: settings.weekendStart,
    weekendEnd: settings.weekendEnd,
    weekendWorkingDays: settings.weekendWorkingDays,
    holidayEnabled: settings.holidayEnabled,
    holidayDates: settings.holidayDates,
    defaultAppointmentDuration: settings.defaultAppointmentDuration,
    bufferDuration: settings.bufferDuration,
    reminderTimings: settings.reminderTimings,
    workOrderTemplate: settings.workOrderTemplate,
    servicePassportTemplate: settings.servicePassportTemplate,
    collectionReceiptTemplate: settings.collectionReceiptTemplate,
  }

  const serializedUser = {
    id: user.id,
    email: user.email,
    workshopId: user.workshopId,
    firstName: user.firstName,
    lastName: user.lastName,
  }

  return (
    <AppShell workshopName={workshop.name} pageTitle="Ayarlar">
      <div className="space-y-5 sm:space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Ayarlar</h2>
          <p className="text-sm text-slate-500 mt-0.5">İş yeri profilinizi, markanızı ve operasyonel ayarlarınızı yönetin</p>
        </div>
        <SettingsTabs
          tab={params.tab || "profile"}
          workshop={serializedWorkshop}
          settings={serializedSettings}
          user={serializedUser}
        />
      </div>
    </AppShell>
  )
}