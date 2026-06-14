"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
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

  function handleTabChange(key: TabKey) {
    setActiveTab(key)
    const params = new URLSearchParams()
    params.set("tab", key)
    router.replace(`/app/settings?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-1 sm:gap-2 border-b border-slate-200 pb-0 -mb-px">
        {TABS.map((t) => {
          const Icon = t.icon
          const isActive = activeTab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => handleTabChange(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                isActive
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              <Icon className="size-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          )
        })}
      </nav>

      <div>
        {activeTab === "profile" && <BusinessProfileForm workshop={workshop} />}
        {activeTab === "branding" && <BrandingForm settings={settings} />}
        {activeTab === "communication" && <CommunicationSettingsForm settings={settings} />}
        {activeTab === "working-hours" && <WorkingHoursForm settings={settings} />}
        {activeTab === "appointment-rules" && <AppointmentRulesForm settings={settings} />}
        {activeTab === "pdf-templates" && <PdfTemplatesForm settings={settings} />}
        {activeTab === "security" && <SecurityInfo workshop={workshop} user={user} />}
      </div>
    </div>
  )
}