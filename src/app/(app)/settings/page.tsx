import { getAppData } from "@/app/(app)/data"
import { getWorkshopSettings } from "./actions"
import { AppShell } from "@/components/layout/app-shell"
import { SettingsTabs } from "./settings-tabs"
import { prisma } from "@/lib/db"
import { getSeatUsage } from "@/lib/rbac"
import { getSeatLimit, type PlanTier } from "@/lib/plan"

export const metadata = {
  title: "Ayarlar",
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
    loginCode: workshop.loginCode,
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
    referralCode: workshop.referralCode,
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
    instagramUrl: settings.instagramUrl,
    facebookUrl: settings.facebookUrl,
    xUrl: settings.xUrl,
    tiktokUrl: settings.tiktokUrl,
    youtubeUrl: settings.youtubeUrl,
    linkedinUrl: settings.linkedinUrl,
    publicWhatsappNumber: settings.publicWhatsappNumber,
    secondaryPhone: settings.secondaryPhone,
    faxNumber: settings.faxNumber,
  }

  const serializedUser = {
    id: user.id,
    email: user.email,
    username: user.username,
    workshopId: user.workshopId,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  }

  // Team data — scoped to this tenant.
  const [members, invites, technicians] = await Promise.all([
    prisma.user.findMany({
      where: { workshopId: user.workshopId },
      // `username` de çekiliyor: e-postasız üye listede kimliksiz görünmesin.
      // BAK-39: `technicianId` de çekiliyor; teknisyen seçim UI'ında görünecek.
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        technicianId: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invite.findMany({
      where: { workshopId: user.workshopId, status: "pending" },
      select: { id: true, email: true, role: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.technician.findMany({
      where: { workshopId: user.workshopId },
      include: { linkedUsers: { select: { id: true } } },
      orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
    }),
  ])

  const serializedInvites = invites.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    expiresAt: i.expiresAt.toISOString(),
  }))

  const accountMissingPersonnel = technicians.filter((t) => t.linkedUsers.length === 0).map((t) => ({
    id: t.id,
    fullName: t.fullName,
    phone: t.phone,
    role: t.role,
    isActive: t.isActive,
    createdAt: t.createdAt.toISOString(),
  }))

  const seatUsage = await getSeatUsage(user.workshopId)
  const seatLimit = getSeatLimit(workshop.planTier as PlanTier, workshop.extraSeats)

  // `wide` (max-w-5xl): sekiz sekmelik şerit `constrained` (768px) genişliğe
  // sığmıyordu ve her masaüstünde kaydırma gerektiriyordu (#278).
  return (
    <AppShell wide workshopName={workshop.name} pageTitle="Ayarlar">
      <div className="space-y-5 sm:space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Ayarlar</h2>
          <p className="text-sm text-muted-foreground mt-0.5">İş yeri profilinizi, markanızı ve operasyonel ayarlarınızı yönetin</p>
        </div>
        <SettingsTabs
          tab={params.tab || "profile"}
          workshop={serializedWorkshop}
          settings={serializedSettings}
          user={serializedUser}
          members={members}
          invites={serializedInvites}
          accountMissingPersonnel={accountMissingPersonnel}
          seatUsed={seatUsage.used}
          seatLimit={seatLimit}
        />
      </div>
    </AppShell>
  )
}
