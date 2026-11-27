import type { Prisma } from "@prisma/client"
import { normalizePlate } from "@/lib/format"
import { calculateOrderTotalsFromMinimal, ORDER_TOTALS_ITEM_SELECT } from "@/lib/totals"
import { currentWorkOrderCustomer } from "@/lib/orders/current-customer"
import { formatWorkOrderNo } from "@/lib/work-order-number"
import { isInvoiceMissing } from "@/lib/orders/invoice-filter"
import { ORDER_LIST_DATA_COLUMN_ORDER } from "@/lib/orders/list-columns"

/** Araç Kabulleri listesi ilk yüklemede ve her "Daha fazla yükle"de bu kadar kayıt büyür. */
export const ORDER_LIST_PAGE_SIZE = 100
/** Tek sayfada gösterilebilecek en çok kayıt; daha eskisine arama/filtreyle ulaşılır. */
export const ORDER_LIST_MAX_ROWS = 500

/** `?limit=` değerini [PAGE_SIZE, MAX_ROWS] aralığında PAGE_SIZE katına çevirir. */
export function resolveOrderListLimit(raw: string | undefined): number {
  const value = Number(raw)
  if (!raw || !Number.isInteger(value) || value < ORDER_LIST_PAGE_SIZE) return ORDER_LIST_PAGE_SIZE
  const rounded = Math.ceil(value / ORDER_LIST_PAGE_SIZE) * ORDER_LIST_PAGE_SIZE
  return Math.min(rounded, ORDER_LIST_MAX_ROWS)
}

/** Bir sonraki pencere; daha yüklenecek kayıt yoksa ya da tavana ulaşıldıysa null. */
export function nextOrderListLimit(limit: number, totalCount: number): number | null {
  if (totalCount <= limit || limit >= ORDER_LIST_MAX_ROWS) return null
  return Math.min(limit + ORDER_LIST_PAGE_SIZE, ORDER_LIST_MAX_ROWS)
}

/** Üst arama kutusu: iş no, plaka, müşteri adı/firma/telefon. */
export function buildOrderSearchWhere(q: string): Prisma.ServiceOrderWhereInput {
  if (!q) return {}
  const contains = { contains: q, mode: "insensitive" as const }
  const plate = normalizePlate(q)
  return {
    OR: [
      { workOrderNo: contains },
      { intakeForm: { vehicle: { plate: contains } } },
      ...(plate ? [{ intakeForm: { vehicle: { plate: { contains: plate } } } }] : []),
      { intakeForm: { vehicle: { customer: { firstName: contains } } } },
      { intakeForm: { vehicle: { customer: { lastName: contains } } } },
      { intakeForm: { vehicle: { customer: { fullName: contains } } } },
      { intakeForm: { vehicle: { customer: { companyName: contains } } } },
      { intakeForm: { vehicle: { customer: { phone: { contains: q } } } } },
    ],
  }
}

/**
 * Filtre parçaları yayılmak yerine AND'le birleşir: birden çoğu aynı anahtarı
 * kullanıyor (durum + teslim → `status`, fatura yok + arama → `OR`) ve yayınca
 * sonraki öncekini sessizce ezerdi.
 */
export function buildOrderListWhere(
  workshopId: string,
  parts: Prisma.ServiceOrderWhereInput[]
): Prisma.ServiceOrderWhereInput {
  return { workshopId, AND: parts }
}

export const ORDER_LIST_ORDER_BY = [{ createdAt: "desc" }, { id: "desc" }] satisfies Prisma.ServiceOrderOrderByWithRelationInput[]

export type OrderListSortColumn = (typeof ORDER_LIST_DATA_COLUMN_ORDER)[number]
export type OrderListSort = { column: OrderListSortColumn; desc: boolean }

/** `?sort=<kolon>&dir=asc|desc` → doğrulanmış sıralama; geçersiz/eksik ise null (varsayılan sıra). */
export function resolveOrderListSort(sort: string | undefined, dir: string | undefined): OrderListSort | null {
  const column = ORDER_LIST_DATA_COLUMN_ORDER.find((id) => id === sort)
  if (!column) return null
  return { column, desc: dir === "desc" }
}

/**
 * Boş değer hep sona gider: Prisma'da `nulls` yalnız bu kolonlar için
 * seçilebilir ve "fiyatsız / faturasız / teslimsiz" kayıtların yönle yer
 * değiştirmesi sıralamayı okunmaz yapardı.
 */
function nullsLast(desc: boolean) {
  return { sort: desc ? "desc" : "asc", nulls: "last" } as const
}

/**
 * Kolon → sunucu `orderBy`. Tüm kayıtlar üzerinde çalışır (yalnız yüklenen
 * pencerede değil) ve `id` ile kararlı bağlanır: aynı değere sahip satırlar
 * "Daha fazla yükle"de sıra değiştirmez.
 *
 * Ekran sırasından BİLİNÇLİ sapmalar (veritabanı sırası, Türkçe etiket değil):
 * - Durum / Ödeme: enum bildirim sırası = iş akışı sırası (Taslak → … → İptal),
 *   etiketin alfabesi değil. Etiket alfabesi bir iş sırası taşımazdı.
 * - Müşteri: `Customer.fullName` (bireyselde ad soyad, kurumsalda firma adı —
 *   ekranda gösterilen adın saklı hâli). Kolon boş olabilir (adı hiç girilmemiş
 *   ya da `fullName` yazmayan bir oluşturma yolundan gelen kayıt; ekranda
 *   ad+soyad ya da "Müşteri" yedeği çizilir) — bu satırlar `nulls: last` ile
 *   sona düşer, yedek ada göre yer almaz. Harf sırası veritabanının
 *   harmanlamasıdır (Türkçe Ç/Ö/Ş/İ için tam `tr` sırası değil).
 * - İş No: `workOrderNo` metni; numarası boş eski kayıtlar (ekranda `BX-…`
 *   yedek numarası) sona düşer.
 * - Araç: plakaya göre (kayıtlı sıkı biçim, boşluksuz).
 * - Teknisyen: atanmamışlar küçükten büyüğe sonda, büyükten küçüğe başta.
 */
export function buildOrderListOrderBy(sort: OrderListSort | null): Prisma.ServiceOrderOrderByWithRelationInput[] {
  if (!sort) return ORDER_LIST_ORDER_BY
  const dir = sort.desc ? "desc" : "asc"
  const nulls = nullsLast(sort.desc)
  const primary: Prisma.ServiceOrderOrderByWithRelationInput =
    sort.column === "workOrderNo" ? { workOrderNo: nulls }
    : sort.column === "vehicle" ? { intakeForm: { vehicle: { plate: dir } } }
    : sort.column === "customer" ? { intakeForm: { vehicle: { customer: { fullName: nulls } } } }
    : sort.column === "status" ? { status: dir }
    : sort.column === "payment" ? { paymentStatus: dir }
    : sort.column === "invoice" ? { invoiceNo: nulls }
    : sort.column === "total" ? { grandTotal: nulls }
    : sort.column === "dates" ? { createdAt: dir }
    : sort.column === "delivery" ? { estimatedDeliveryAt: nulls }
    : { assignedTechnician: { fullName: dir } }
  return [primary, { createdAt: "desc" }, { id: "desc" }]
}

/** Listenin gerçekten çizdiği alanlar — tam satır/ilişki çekilmez. */
export const ORDER_LIST_SELECT = {
  id: true,
  workOrderNo: true,
  status: true,
  paymentStatus: true,
  assignedTechnicianId: true,
  estimatedDeliveryAt: true,
  createdAt: true,
  discountAmount: true,
  taxRate: true,
  invoiceNo: true,
  items: { select: ORDER_TOTALS_ITEM_SELECT },
  assignedTechnician: { select: { fullName: true } },
  intakeForm: {
    select: {
      vehicle: {
        select: {
          id: true,
          plate: true,
          brand: true,
          model: true,
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              fullName: true,
              companyName: true,
              type: true,
              phone: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ServiceOrderSelect

export type OrderListRow = {
  id: string
  workOrderNo: string
  status: string
  paymentStatus: string
  assignedTechnicianId: string | null
  assignedTechnicianName: string | null
  estimatedDeliveryAt: string | null
  createdAt: string
  grandTotal: number
  hasPrice: boolean
  invoiceNo: string | null
  /** Fatura beklenen statüde numara girilmemiş — sunucuda hesaplanır. */
  invoiceMissing: boolean
  vehicle: { plate: string; brand: string; model: string; id?: string }
  customer: {
    id?: string
    firstName: string | null
    lastName: string | null
    fullName: string | null
    companyName: string | null
    type: string
    phone: string
  }
}

export function toOrderListRow(
  order: Prisma.ServiceOrderGetPayload<{ select: typeof ORDER_LIST_SELECT }>
): OrderListRow {
  const customer = currentWorkOrderCustomer(order.intakeForm)
  const totals = calculateOrderTotalsFromMinimal(order.items, {
    discountAmount: order.discountAmount,
    taxRate: order.taxRate,
  })
  const { vehicle } = order.intakeForm
  return {
    id: order.id,
    workOrderNo: formatWorkOrderNo(order),
    status: order.status,
    paymentStatus: order.paymentStatus,
    assignedTechnicianId: order.assignedTechnicianId,
    assignedTechnicianName: order.assignedTechnician?.fullName || null,
    estimatedDeliveryAt: order.estimatedDeliveryAt ? order.estimatedDeliveryAt.toISOString() : null,
    createdAt: order.createdAt.toISOString(),
    grandTotal: totals.grandTotal,
    hasPrice: totals.hasAnyPrice,
    invoiceNo: order.invoiceNo,
    invoiceMissing: isInvoiceMissing(order.status, order.invoiceNo),
    vehicle: { id: vehicle.id, plate: vehicle.plate, brand: vehicle.brand, model: vehicle.model },
    customer: {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      fullName: customer.fullName,
      companyName: customer.companyName,
      type: customer.type,
      phone: customer.phone,
    },
  }
}
