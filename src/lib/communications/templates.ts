import type { CommunicationTemplateKey, SendableChannel, TemplateVariables } from "./types"

export type TemplateChannel = SendableChannel

export interface CommunicationTemplate {
  key: CommunicationTemplateKey
  label: string
  description: string
  channels: TemplateChannel[]
}

export const COMMUNICATION_TEMPLATES: CommunicationTemplate[] = [
  {
    key: "appointment_created",
    label: "Randevu Oluşturuldu",
    description: "Yeni randevu oluşturulduğunda müşteriye bildirim gönderilir",
    channels: ["sms", "email"],
  },
  {
    key: "appointment_reminder",
    label: "Randevu Hatırlatması",
    description: "Randevu saatinden 24 saat ve 1 saat önce hatırlatma gönderilir",
    channels: ["sms", "email"],
  },
  {
    key: "intake_approval",
    label: "Araç Kabul Onayı",
    description: "Müşteri onayı istendiğinde onay linki gönderilir",
    channels: ["sms"],
  },
  {
    key: "quote_ready",
    label: "Teklif Hazır",
    description: "Teklif hazır olduğunda müşteriye bildirim ve onay linki gönderilir",
    channels: ["sms", "email"],
  },
  {
    key: "work_order_completed",
    label: "Araç Kabul Tamamlandı",
    description: "Araç teslimata hazır olduğunda müşteriye bildirim ve portal linki gönderilir",
    channels: ["sms", "email"],
  },
  {
    key: "maintenance_reminder",
    label: "Bakım Hatırlatması",
    description: "Yaklaşan veya gecikmiş bakım hatırlatması gönderilir",
    channels: ["sms", "email"],
  },
  {
    key: "payment_reminder",
    label: "Ödeme Hatırlatması",
    description: "Ödeme bekleyen araç kabulleri için hatırlatma gönderilir",
    channels: ["sms", "email"],
  },
  {
    key: "vehicle_passport_share",
    label: "Araç Pasaportu Paylaşım",
    description: "Araç pasaportu linki müşteriye gönderilir",
    channels: ["sms", "email"],
  },
]

const TEMPLATE_DEFAULTS: Record<CommunicationTemplateKey, Record<TemplateChannel, string>> = {
  appointment_created: {
    sms: "Sayın {customerName}, {workshopName} - {appointmentDate} {appointmentTime} tarihinde randevunuz oluşturulmuştur. Detaylar: {portalLink}",
    email: `<h2>Merhaba {customerName},</h2><p>{workshopName} tarafından <strong>{appointmentDate} {appointmentTime}</strong> tarihinde randevunuz oluşturulmuştur.</p><p>Araç: {vehiclePlate}</p><p><a href="{portalLink}">Detayları Görüntüle</a></p>`,
  },
  appointment_reminder: {
    sms: "Sayın {customerName}, {workshopName} - {appointmentDay} ({appointmentDate} {appointmentTime}) randevunuz bulunmaktadır.",
    email: `<h2>Randevu Hatırlatması</h2><p>Sayın {customerName},</p><p><strong>{appointmentDate} {appointmentTime}</strong> tarihindeki randevunuzu hatırlatmak isteriz.</p><p>Araç: {vehiclePlate}</p><p>{customMessage}</p>`,
  },
  intake_approval: {
    sms: "Sayın {customerName}, {workshopName} - araç kabul onayınız beklenmektedir. Onay linki: {approvalLink}",
    email: `<h2>Araç Kabul Onayı</h2><p>Sayın {customerName},</p><p>{workshopName} - aracınızın ({vehiclePlate}) servis kabul formunu onaylamanız gerekmektedir.</p><p><a href="{approvalLink}">Onaylama Sayfasına Git</a></p>`,
  },
  quote_ready: {
    sms: "Sayın {customerName}, {workshopName} - teklifiniz hazırdır. Teklif No: {quoteNo}. Detaylar: {portalLink}",
    email: `<h2>Teklifiniz Hazır</h2><p>Sayın {customerName},</p><p>{workshopName} - teklifiniz hazırdır.</p><p><strong>Teklif No:</strong> {quoteNo}<br/><strong>Araç:</strong> {vehiclePlate}<br/><strong>Toplam:</strong> {totalAmount}</p><p><a href="{portalLink}">Teklifi Görüntüle</a></p>`,
  },
  work_order_completed: {
    sms: "Sayın {customerName}, {workshopName} - aracınız ({vehiclePlate}) teslimata hazırdır. Detaylar: {portalLink}",
    email: `<h2>Aracınız Teslimata Hazır</h2><p>Sayın {customerName},</p><p>{workshopName} - aracınız (<strong>{vehiclePlate}</strong>) teslimata hazırdır.</p><p><strong>Araç Kabul No:</strong> {workOrderNo}</p><p><a href="{portalLink}">Detayları Görüntüle</a></p>`,
  },
  maintenance_reminder: {
    sms: "Sayın {customerName}, {workshopName} - aracınızın ({vehiclePlate}) {maintenanceType} bakımı yaklaştı. Son tarih: {dueDate}",
    email: `<h2>Bakım Hatırlatması</h2><p>Sayın {customerName},</p><p>{workshopName} - aracınızın ({vehiclePlate}) <strong>{maintenanceType}</strong> bakımı yaklaştı.</p><p><strong>Son tarih:</strong> {dueDate}</p><p><a href="{portalLink}">Randevu Al</a></p>`,
  },
  payment_reminder: {
    sms: "Sayın {customerName}, {workshopName} - ödemeniz beklenmektedir. Toplam: {totalAmount}. Detaylar: {portalLink}",
    email: `<h2>Ödeme Hatırlatması</h2><p>Sayın {customerName},</p><p>{workshopName} - ödemeniz beklenmektedir.</p><p><strong>Toplam:</strong> {totalAmount}<br/><strong>Araç:</strong> {vehiclePlate}</p><p><a href="{portalLink}">Detayları Görüntüle</a></p>`,
  },
  vehicle_passport_share: {
    sms: "Sayın {customerName}, {workshopName} - araç pasaportunuz: {passportLink}",
    email: `<h2>Araç Pasaportunuz</h2><p>Sayın {customerName},</p><p>{workshopName} - aracınızın ({vehiclePlate}) servis geçmişini görüntüleyebilirsiniz.</p><p><a href="{passportLink}">Araç Pasaportunu Görüntüle</a></p>`,
  },
}

export function getDefaultTemplate(key: CommunicationTemplateKey, channel: TemplateChannel): string {
  return TEMPLATE_DEFAULTS[key]?.[channel] ?? ""
}

export function renderTemplate(template: string, variables: TemplateVariables): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    if (value != null) {
      result = result.replaceAll(`{${key}}`, String(value))
    }
  }
  return result
}

export function sanitizeTemplate(template: string): string {
  return template
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "")
}