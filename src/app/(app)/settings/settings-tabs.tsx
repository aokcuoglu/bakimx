"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { BusinessProfileForm } from "@/components/settings/business-profile-form"
import { BrandingForm } from "@/components/settings/branding-form"
import { CommunicationSettingsForm } from "@/components/settings/communication-settings-form"
import { WorkingHoursForm } from "@/components/settings/working-hours-form"
import { AppointmentRulesForm } from "@/components/settings/appointment-rules-form"
import { PdfTemplatesForm } from "@/components/settings/pdf-templates-form"
import { SecurityInfo } from "@/components/settings/security-info"
import {
  TeamManagement,
  type AccountMissingPersonnel,
  type PendingInvite,
  type TeamMember,
} from "@/components/settings/team-management"
import type { UserRole } from "@prisma/client"
import {
  Building2,
  Palette,
  MessageSquare,
  Clock,
  CalendarClock,
  FileText,
  Shield,
  Users,
} from "lucide-react"

type TabKey = "profile" | "branding" | "communication" | "working-hours" | "appointment-rules" | "pdf-templates" | "team" | "security"

/**
 * Sekme etiketleri kısa tutuldu (#278): sayfanın kendisi zaten "Ayarlar" olduğu
 * için her sekmede tekrar eden "… Ayarları / … Kuralları / … Şablonları" ekleri
 * bilgi taşımıyor ama şeridi 1125px'e çıkarıp her masaüstünde kaydırma
 * gerektiriyordu. Kısaltma sonrası şerit `wide` (max-w-5xl) kaba sığıyor.
 */
const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "profile", label: "İş Yeri Profili", icon: Building2 },
  { key: "branding", label: "Marka", icon: Palette },
  { key: "communication", label: "İletişim", icon: MessageSquare },
  { key: "working-hours", label: "Çalışma Saatleri", icon: Clock },
  { key: "appointment-rules", label: "Randevu", icon: CalendarClock },
  { key: "pdf-templates", label: "PDF", icon: FileText },
  { key: "team", label: "Ekip", icon: Users },
  { key: "security", label: "Güvenlik", icon: Shield },
]

type WorkshopData = {
  id: string
  name: string
  /** İş yeri giriş kodu (BAK-40) — kullanıcı adıyla giriş bunun üzerinden çözülür. */
  loginCode: string
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
  instagramUrl: string | null
  facebookUrl: string | null
  xUrl: string | null
  tiktokUrl: string | null
  youtubeUrl: string | null
  linkedinUrl: string | null
  publicWhatsappNumber: string | null
  secondaryPhone: string | null
  faxNumber: string | null
}

type UserData = {
  id: string
  /** E-postasız (kullanıcı adıyla açılmış) hesaplarda NULL — BAK-40. */
  email: string | null
  username: string | null
  workshopId: string
  firstName: string | null
  lastName: string | null
  role: UserRole
}

export function SettingsTabs({
  tab: initialTab,
  workshop,
  settings,
  user,
  members,
  invites,
  accountMissingPersonnel,
  seatUsed,
  seatLimit,
}: {
  tab: string
  workshop: WorkshopData
  settings: SettingsData
  user: UserData
  members: TeamMember[]
  invites: PendingInvite[]
  accountMissingPersonnel: AccountMissingPersonnel[]
  seatUsed: number
  seatLimit: number
}) {
  const canManageTeam = user.role === "owner" || user.role === "manager"
  const router = useRouter()
  const searchParams = useSearchParams()
  // Aktif sekme tek doğru kaynak olarak URL'den türetilir. Böylece zaten
  // /app/settings'teyken sidebar'dan aynı route'a (?tab=...) tıklandığında
  // (bileşen remount olmadan, yalnızca re-render olurken) sekme güncellenir.
  // `initialTab` yalnızca query parametresi yokken yedek varsayılan olarak kalır.
  const activeTab = (searchParams.get("tab") as TabKey) || (initialTab as TabKey) || "profile"

  // Şerit taşma durumu: hangi yönde kaydırılacak içerik kaldığını izler, kenar
  // solmaları buna göre çıkar. Base UI `TabsList`'e ref geçirmek yerine sarmalayıcı
  // üzerinden sorgulanır — bileşenin ref sözleşmesine bağımlılık kurulmaz.
  const stripRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: false, end: false })

  useEffect(() => {
    const list = stripRef.current?.querySelector<HTMLElement>('[data-slot="tabs-list"]')
    if (!list) return

    const update = () => {
      const max = list.scrollWidth - list.clientWidth
      setEdges({ start: list.scrollLeft > 1, end: list.scrollLeft < max - 1 })
    }

    update()
    list.addEventListener("scroll", update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(list)
    return () => {
      list.removeEventListener("scroll", update)
      observer.disconnect()
    }
  }, [])

  function handleTabChange(key: string | null) {
    if (!key) return
    const params = new URLSearchParams()
    params.set("tab", key)
    router.replace(`/settings?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div ref={stripRef} className="relative">
          <TabsList variant="line" className="flex w-full flex-nowrap gap-1 sm:gap-2 border-b border-border pb-0 -mb-px overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => {
              const Icon = t.icon
              const isActive = activeTab === t.key
              return (
                <TabsTrigger key={t.key} value={t.key} className="px-3 py-2.5 shrink-0 flex-none">
                  <Icon className="size-4" />
                  {/* Dar ekranda etiketler gizlenip yalnız ikon kalıyordu; ikonlar
                      birbirine yakın anlamda olduğu için hangi sekmede olunduğu
                      anlaşılmıyordu. Aktif sekmenin etiketi her genişlikte durur. */}
                  <span className={isActive ? "inline" : "hidden sm:inline"}>{t.label}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>
          {/* Kaydırma çubuğu gizli olduğu için taşma görünmüyordu; kenar
              solmaları yalnızca o yönde kaydırılacak içerik varken çıkar. */}
          {edges.start && (
            <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background to-transparent" />
          )}
          {edges.end && (
            <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background to-transparent" />
          )}
        </div>

        <TabsContent value="profile"><BusinessProfileForm workshop={workshop} contact={settings} /></TabsContent>
        <TabsContent value="branding"><BrandingForm settings={settings} /></TabsContent>
        <TabsContent value="communication"><CommunicationSettingsForm settings={settings} /></TabsContent>
        <TabsContent value="working-hours"><WorkingHoursForm settings={settings} /></TabsContent>
        <TabsContent value="appointment-rules"><AppointmentRulesForm settings={settings} /></TabsContent>
        <TabsContent value="pdf-templates"><PdfTemplatesForm settings={settings} /></TabsContent>
        <TabsContent value="team">
          <TeamManagement
              members={members}
              invites={invites}
              currentUserId={user.id}
              currentUserRole={user.role}
              canManage={canManageTeam}
              seatUsed={seatUsed}
              seatLimit={seatLimit}
              workshopName={workshop.name}
              loginCode={workshop.loginCode}
              accountMissingPersonnel={accountMissingPersonnel}
              logoUrl={workshop.logoUrl || undefined}
          />
        </TabsContent>
        <TabsContent value="security"><SecurityInfo workshop={workshop} user={user} /></TabsContent>
      </Tabs>
    </div>
  )
}
