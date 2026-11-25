/**
 * Kayıtlı iletişim kanalları. `whatsapp` yalnız GEÇMİŞ kayıtları okumak için
 * durur (CommunicationLog / şablon satırları) — WhatsApp Business API gönderimi
 * #746 ile kaldırıldı, yeni gönderim yalnız {@link SendableChannel} ile yapılır.
 */
export type CommunicationType = "sms" | "whatsapp" | "email"

/** Gerçekten mesaj gönderebilen kanallar (#746). */
export type SendableChannel = Exclude<CommunicationType, "whatsapp">

export type CommunicationStatus = "pending" | "sent" | "failed" | "skipped"

export type CommunicationTemplateKey =
  | "appointment_reminder"
  | "appointment_created"
  | "intake_approval"
  | "quote_ready"
  | "work_order_completed"
  | "maintenance_reminder"
  | "payment_reminder"
  | "vehicle_passport_share"

export interface CommunicationResult {
  success: boolean
  providerId?: string
  error?: string
}

export interface SMSProvider {
  sendSMS(to: string, message: string): Promise<CommunicationResult>
}

export interface EmailProvider {
  sendEmail(to: string, subject: string, htmlBody: string, textBody?: string): Promise<CommunicationResult>
}

export interface CommunicationLogEntry {
  id: string
  workshopId: string
  type: CommunicationType
  provider: string
  recipient: string
  status: CommunicationStatus
  templateKey: string | null
  entityType: string | null
  entityId: string | null
  errorMessage: string | null
  sentAt: Date
}

export interface TemplateVariables {
  workshopName?: string
  customerName?: string
  vehiclePlate?: string
  vehicleBrand?: string
  vehicleModel?: string
  appointmentDay?: string
  appointmentDate?: string
  appointmentTime?: string
  workOrderNo?: string
  quoteNo?: string
  totalAmount?: string
  approvalLink?: string
  portalLink?: string
  passportLink?: string
  maintenanceType?: string
  dueDate?: string
  dueMileage?: string
  daysRemaining?: string
  customMessage?: string
}