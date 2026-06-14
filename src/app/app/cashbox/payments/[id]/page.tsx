import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { formatTRY } from "@/lib/format"
import { formatDateTime } from "@/lib/utils-client"
import { PaymentMethodBadge, CollectionStatusBadge, PaymentBadge } from "@/components/app/status-badge"
import { CancelCollectionButton } from "@/components/app/collection-cancel-button"
import { calculateOrderTotalsFromMinimal } from "@/lib/totals"
import { ArrowLeft, Receipt, Calendar, User, FileText, Hash, MessageSquare, CreditCard, Banknote, Info, AlertTriangle } from "lucide-react"

const methodIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  cash: Banknote,
  credit_card: CreditCard,
  bank_transfer: CreditCard,
  other: Receipt,
}

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, workshop } = await getAppData()

  const collection = await prisma.collectionPayment.findFirst({
    where: { id, workshopId: user.workshopId },
    include: {
      customer: {
        select: { id: true, type: true, firstName: true, lastName: true, fullName: true, companyName: true, phone: true, email: true },
      },
      serviceOrder: {
        include: {
          items: { select: { totalPrice: true, unitPrice: true, quantity: true, type: true } },
          intakeForm: {
            select: { vehicle: { select: { plate: true, brand: true, model: true } } },
          },
        },
      },
    },
  })

  if (!collection) notFound()

  const nameFor = () =>
    collection.customer.type === "corporate"
      ? collection.customer.companyName || "—"
      : collection.customer.fullName || `${collection.customer.firstName ?? ""} ${collection.customer.lastName ?? ""}`.trim() || "—"

  const orderTotals = collection.serviceOrder
    ? calculateOrderTotalsFromMinimal(collection.serviceOrder.items, {
        discountAmount: collection.serviceOrder.discountAmount,
        taxRate: collection.serviceOrder.taxRate,
      })
    : null

  const paidByOtherCollections = collection.serviceOrder
    ? (await prisma.collectionPayment.aggregate({
        where: {
          workshopId: user.workshopId,
          serviceOrderId: collection.serviceOrder.id,
          status: "completed",
          id: { not: collection.id },
        },
        _sum: { amount: true },
      }))._sum.amount || 0
    : 0

  const MethodIcon = methodIcons[collection.method] || Receipt

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Tahsilat Detayı" showGlobalSearch={false}>
      <div className="space-y-5 sm:space-y-6 max-w-3xl">
        <div className="flex items-center text-sm text-slate-500">
          <Link href="/app/cashbox/payments" className="hover:text-slate-700 inline-flex items-center gap-1">
            <ArrowLeft className="size-3.5" />
            Tahsilatlar
          </Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700 font-medium">Tahsilat Detayı</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{formatTRY(collection.amount)}</h2>
            <div className="flex items-center gap-2 mt-1">
              <PaymentMethodBadge method={collection.method} size="md" />
              <CollectionStatusBadge status={collection.status} size="md" />
            </div>
          </div>
          {collection.status === "completed" && (
            <CancelCollectionButton collectionId={collection.id} />
          )}
          {collection.status === "cancelled" && collection.cancellationReason && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-2">
              <h3 className="text-sm font-semibold text-rose-800 flex items-center gap-2">
                <AlertTriangle className="size-4" />
                İptal Bilgisi
              </h3>
              <p className="text-sm text-rose-700">{collection.cancellationReason}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Receipt className="size-4 text-slate-500" />
                Tahsilat Bilgileri
              </h3>
              <DetailRow icon={Calendar} label="Tahsilat Tarihi" value={formatDateTime(collection.paymentDate)} />
              <DetailRow icon={MethodIcon} label="Ödeme Yöntemi" value={
                collection.method === "cash" ? "Nakit" :
                collection.method === "credit_card" ? "Kredi Kartı" :
                collection.method === "bank_transfer" ? "Havale/EFT" : "Diğer"
              } />
              <DetailRow icon={Hash} label="Referans No" value={collection.referenceNo || "—"} />
              {collection.note && <DetailRow icon={MessageSquare} label="Not" value={collection.note} />}
              <DetailRow icon={Calendar} label="Kayıt Tarihi" value={formatDateTime(collection.createdAt)} />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <User className="size-4 text-slate-500" />
                Müşteri
              </h3>
              <Link href={`/app/customers/${collection.customer.id}`} className="block rounded-lg border border-slate-100 bg-slate-50 p-3 hover:bg-slate-100 transition-colors">
                <p className="text-sm font-semibold text-slate-900">{nameFor()}</p>
                <p className="text-xs text-slate-500 mt-0.5">{collection.customer.phone}</p>
                {collection.customer.email && <p className="text-xs text-slate-500">{collection.customer.email}</p>}
              </Link>
            </div>
          </div>

          {collection.serviceOrder && orderTotals && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="size-4 text-slate-500" />
                İş Emri
              </h3>
              <Link href={`/app/orders/${collection.serviceOrder!.id}`} className="block rounded-lg border border-slate-100 bg-slate-50 p-3 hover:bg-slate-100 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-slate-900">{collection.serviceOrder.workOrderNo || "—"}</span>
                  <PaymentBadge status={collection.serviceOrder.paymentStatus} size="sm" />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {collection.serviceOrder.intakeForm.vehicle.plate} &bull; {collection.serviceOrder.intakeForm.vehicle.brand} {collection.serviceOrder.intakeForm.vehicle.model}
                </p>
              </Link>

              <div className="border-t border-slate-100 pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">İş Emri Toplamı</span>
                  <span className="font-medium text-slate-900">{formatTRY(orderTotals.grandTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Bu Tahsilat</span>
                  <span className="font-medium text-blue-700">{formatTRY(collection.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Diğer Tahsilatlar</span>
                  <span className="font-medium text-emerald-700">{formatTRY(paidByOtherCollections)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-slate-100 pt-2">
                  <span className="text-slate-500 font-medium">Toplam Tahsil Edilen</span>
                  <span className="font-bold text-emerald-700">{formatTRY(collection.amount + paidByOtherCollections)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Kalan Bakiye</span>
                  <span className="font-bold text-rose-700">{formatTRY(Math.max(0, orderTotals.grandTotal - collection.amount - paidByOtherCollections))}</span>
                </div>
              </div>

              <Link
                href={`/app/orders/${collection.serviceOrder.id}`}
                className="block text-center text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
              >
                İş Emri Detayına Git →
              </Link>
            </div>
          )}
        </div>

        {!collection.serviceOrder && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 flex items-start gap-2">
            <Info className="size-3.5 mt-0.5 shrink-0" />
            <span>Bu tahsilat herhangi bir iş emrine bağlı değil.</span>
          </div>
        )}
      </div>
    </AppShell>
  )
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-slate-500 flex items-center gap-1.5">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span className="text-slate-900 font-medium text-right">{value}</span>
    </div>
  )
}