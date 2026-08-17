/**
 * Servisler arası araç geçmişinin (BAK-77) dış dünyaya açılan tipleri.
 *
 * ⚠️ FİYAT YASAĞI — bu dosyadaki hiçbir tipte para alanı YOKTUR ve olmayacaktır.
 * Bir servisin başka bir servisin fiyatlandırmasını görmesi ürünün kırmızı
 * çizgisidir; kalem tutarı, iskonto, KDV, ödeme durumu ve genel toplam bu
 * katmana hiç girmez. Tip seviyesindeki bu boşluk, `no-price-leak.test.ts`
 * tarafından üretilen nesne üzerinde ayrıca doğrulanır — yani birisi ileride
 * tipe alan eklerse test düşer.
 */

/** Maskenin neden kalktığı. `null` ⇒ maske duruyor. */
export type VehicleHistoryAccessReason =
  /** Ruhsat bu atölyede okutuldu (VehicleHistoryGrant). */
  | "registration_scan"
  /** Atölyenin bu araç için kendi kabul/iş emri kaydı zaten var. */
  | "own_record"

/** Yabancı bir atölyede yapılmış tek bir iş emri. */
export type CrossWorkshopOrder = {
  /**
   * Liste anahtarı. Yabancı iş emrinin gerçek id'si DEĞİL — bilerek opaktır ki
   * istemciye başka kiracının birincil anahtarı sızmasın ve tıklanabilir bir
   * rota kurma denemesi doğmasın.
   */
  key: string
  /** Maske açıkken gerçek atölye adı, kapalıyken `***`. */
  workshopName: string
  workshopCity: string | null
  servicedAt: string
  status: string
  arrivalReason: string | null
  mileage: number | null
  complaint: string | null
  /** Yapılan işin kalem başlıkları (parça/işçilik adı). Adet ve fiyat YOK. */
  itemLabels: string[]
}

/** Yabancı bir atölyede işaretlenmiş hasar. */
export type CrossWorkshopDamage = {
  key: string
  workshopName: string
  zone: string
  damageType: string
  severity: string
  markedAt: string
}

/** Aracın başka serviste kayıtlı sahibi. Maskeliyken hepsi kırpılır. */
export type CrossWorkshopOwner = {
  name: string
  phone: string
  email: string | null
  city: string | null
}

/**
 * Aracın teknik künyesi. Kimlik numarası, vergi numarası ve adres BU KATMANA
 * HİÇ GİRMEZ — maskeli hâlleri bile taşınmaz.
 */
export type CrossWorkshopVehicle = {
  brand: string | null
  model: string | null
  vehicleType: string | null
  modelYear: number | null
  color: string | null
  fuelType: string | null
  transmission: string | null
  vin: string | null
  engineNo: string | null
  lastKnownMileage: number | null
}

export type CrossWorkshopHistory = {
  /** Normalize plaka. */
  plate: string
  /** `true` ⇒ kişisel alanlar maskeli döndü. */
  locked: boolean
  accessReason: VehicleHistoryAccessReason | null
  /** Aracı tanıyan BAŞKA atölye sayısı. Maskeliyken de gösterilir (kimliksiz). */
  workshopCount: number
  orderCount: number
  lastServicedAt: string | null
  owner: CrossWorkshopOwner | null
  vehicle: CrossWorkshopVehicle | null
  orders: CrossWorkshopOrder[]
  damageMarks: CrossWorkshopDamage[]
}
