import type { EntryMethod } from "@/lib/intake/entry-wizard"

/**
 * Ofisteki "Yeni Araç Kabul" girişlerinin ortak hedefi (#813).
 *
 * Genel Bakış, Araç Kabulleri listesi ve oluşturma merkezi kabulü doğrudan
 * plaka kamerasıyla açar — teknisyen panelindeki "Araç Kabul" kartıyla aynı
 * odaklı akış. `from=technician` bilinçli olarak YOK: ofis kabuğu (sidebar)
 * kalır ve geri bağlantısı Araç Kabulleri'ne gider (`orders/new/page.tsx`).
 *
 * Müşteri/araç detayındaki düğmeler buraya bağlanmaz: onlar kabulü
 * `customerId`/`vehicleId` ile ön doldurarak açar, kamera gerekmez.
 */
const NEW_INTAKE_ENTRY: EntryMethod = "plate"

export const NEW_INTAKE_HREF = `/orders/new?entry=${NEW_INTAKE_ENTRY}`
