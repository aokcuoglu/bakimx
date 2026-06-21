"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { BusinessProfileForm } from "@/components/app/settings/business-profile-form"
import { BrandingForm } from "@/components/app/settings/branding-form"
import { CommunicationSettingsForm } from "@/components/app/settings/communication-settings-form"
import { WorkingHoursForm } from "@/components/app/settings/working-hours-form"
import { AppointmentRulesForm } from "@/components/app/settings/appointment-rules-form"
import { PdfTemplatesForm } from "@/components/app/settings/pdf-templates-form"
import { SecurityInfo } from "@/components/app/settings/security-info"
import {
  Building2,
  Palette,
  MessageSquare,
  Clock,
  CalendarClock,
  FileText,
  Shield,
} from "lucide-react"

type TabKey = "profile" | "branding" | "communication" | "working-hours" | "appointment-rules" | "pdf-templates" | "security"

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "profile", label: "İş Yeri Profili", icon: Building2 },
  { key: "branding", label: "Marka Ayarları", icon: Palette },
  { key: "communication", label: "İletişim Ayarları", icon: MessageSquare },
  { key: "working-hours", label: "Çalışma Saatleri", icon: Clock },
  { key: "appointment-rules", label: "Randevu Kuralları", icon: CalendarClock },
  { key: "pdf-templates", label: "PDF Şablonları", icon: FileText },
  { key: "security", label: "Güvenlik", icon: Shield },
]

type WorkshopData = {
  id: string
  name: string
  phone: string
  city: string
  district: string | null
  address: string
  email: string | null
  website: string | null
  logoUrl: string | null
  taxNumber: string | null
  taxOffice: string | null
  invoiceTitle: string | null
  createdAt: string
}

type SettingsData = {
  pdfLogoUrl: string | null
  publicPortalLogoUrl: string | null
  passportLogoUrl: string | null
  themeColor: string | null
  accentColor: string | null
  smsProvider: string
  smsSenderName: string | null
  whatsappProvider: string
  whatsappPhoneNumber: string | null
  emailProvider: string
  emailFromAddress: string | null
  emailFromName: string | null
  weekdayStart: string
  weekdayEnd: string
  weekdayWorkingDays: string
  weekendStart: string
  weekendEnd: string
  weekendWorkingDays: string
  holidayEnabled: boolean
  holidayDates: string | null
  defaultAppointmentDuration: number
  bufferDuration: number
  reminderTimings: string
  workOrderTemplate: string | null
  servicePassportTemplate: string | null
  collectionReceiptTemplate: string | null
}

type UserData = {
  id: string
  email: string
  workshopId: string
  firstName: string | null
  lastName: string | null
}

export function SettingsTabs({
  tab: initialTab,
  workshop,
  settings,
  user,
}: {
  tab: string
  workshop: WorkshopData
  settings: SettingsData
  user: UserData
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>((initialTab as TabKey) || "profile")

  function handleTabChange(key: string | null) {
    if (!key) return
    setActiveTab(key as TabKey)
    const params = new URLSearchParams()
    params.set("tab", key)
    router.replace(`/app/settings?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList variant="line" className="flex w-full flex-nowrap gap-1 sm:gap-2 border-b border-border pb-0 -mb-px overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <TabsTrigger key={t.key} value={t.key} className="px-3 py-2.5 shrink-0 flex-none">
                <Icon className="size-4" />
                <span className="hidden sm:inline">{t.label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value="profile"><BusinessProfileForm workshop={workshop} /></TabsContent>
        <TabsContent value="branding"><BrandingForm settings={settings} /></TabsContent>
        <TabsContent value="communication"><CommunicationSettingsForm settings={settings} /></TabsContent>
        <TabsContent value="working-hours"><WorkingHoursForm settings={settings} /></TabsContent>
        <TabsContent value="appointment-rules"><AppointmentRulesForm settings={settings} /></TabsContent>
        <TabsContent value="pdf-templates"><PdfTemplatesForm settings={settings} /></TabsContent>
        <TabsContent value="security"><SecurityInfo workshop={workshop} user={user} /></TabsContent>
      </Tabs>
    </div>
  )
}