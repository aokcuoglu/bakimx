import { getAppData } from "@/app/(app)/data"
import { getWorkshopSettings } from "./actions"

export type SerializedWorkshop = {
  id: string
  name: string
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
  referralCode: string | null
  createdAt: string
}

export type SerializedWorkshopSettings = {
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

export type SerializedSettingsUser = {
  id: string
  email: string | null
  username: string | null
  workshopId: string
  firstName: string | null
  lastName: string | null
  role: import("@prisma/client").UserRole
}

/** Shared workshop + settings payload for path-based settings pages. */
export async function loadWorkshopSettings() {
  const { user, workshop } = await getAppData()
  if (!workshop) {
    return { user, workshop: null as null, settings: null as null, serializedWorkshop: null as null, serializedSettings: null as null, serializedUser: null as null }
  }

  const { settings } = await getWorkshopSettings()

  const serializedWorkshop: SerializedWorkshop = {
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

  const serializedSettings: SerializedWorkshopSettings = {
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

  const serializedUser: SerializedSettingsUser = {
    id: user.id,
    email: user.email,
    username: user.username,
    workshopId: user.workshopId,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  }

  return { user, workshop, settings, serializedWorkshop, serializedSettings, serializedUser }
}
