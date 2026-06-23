import { getAppData } from "@/app/(app)/data"
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
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/cashbox/payments" className="hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-3.5" />
            Tahsilatlar
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Tahsilat Detayı</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">{formatTRY(collection.amount)}</h2>
            <div className="flex items-center gap-2 mt-1">
              <PaymentMethodBadge method={collection.method} size="md" />
              <CollectionStatusBadge status={collection.status} size="md" />
            </div>
          </div>
          {collection.status === "completed" && (
            <CancelCollectionButton collectionId={collection.id} />
          )}
          {collection.status === "cancelled" && collection.cancellationReason && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 space-y-2">
              <h3 className="text-sm font-semibold text-destructive flex items-center gap-2">
                <AlertTriangle className="size-4" />
                İptal Bilgisi
              </h3>
              <p className="text-sm text-destructive">{collection.cancellationReason}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Receipt className="size-4 text-muted-foreground" />
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

            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <User className="size-4 text-muted-foreground" />
                Müşteri
              </h3>
              <Link href={`/customers/${collection.customer.id}`} className="block rounded-lg border border-border bg-muted p-3 hover:bg-muted transition-colors">
                <p className="text-sm font-semibold text-foreground">{nameFor()}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{collection.customer.phone}</p>
                {collection.customer.email && <p className="text-xs text-muted-foreground">{collection.customer.email}</p>}
              </Link>
            </div>
          </div>

          {collection.serviceOrder && orderTotals && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" />
                İş Emri
              </h3>
              <Link href={`/orders/${collection.serviceOrder!.id}`} className="block rounded-lg border border-border bg-muted p-3 hover:bg-muted transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-foreground">{collection.serviceOrder.workOrderNo || "—"}</span>
                  <PaymentBadge status={collection.serviceOrder.paymentStatus} size="sm" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {collection.serviceOrder.intakeForm.vehicle.plate} &bull; {collection.serviceOrder.intakeForm.vehicle.brand} {collection.serviceOrder.intakeForm.vehicle.model}
                </p>
              </Link>

              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">İş Emri Toplamı</span>
                  <span className="font-medium text-foreground">{formatTRY(orderTotals.grandTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Bu Tahsilat</span>
                  <span className="font-medium text-primary">{formatTRY(collection.amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Diğer Tahsilatlar</span>
                  <span className="font-medium text-success">{formatTRY(paidByOtherCollections)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-border pt-2">
                  <span className="text-muted-foreground font-medium">Toplam Tahsil Edilen</span>
                  <span className="font-bold text-success">{formatTRY(collection.amount + paidByOtherCollections)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Kalan Bakiye</span>
                  <span className="font-bold text-destructive">{formatTRY(Math.max(0, orderTotals.grandTotal - collection.amount - paidByOtherCollections))}</span>
                </div>
              </div>

              <Link
                href={`/orders/${collection.serviceOrder.id}`}
                className="block text-center text-sm text-primary hover:text-primary/80 font-medium mt-2"
              >
                İş Emri Detayına Git →
              </Link>
            </div>
          )}
        </div>

        {!collection.serviceOrder && (
          <div className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
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
      <span className="text-muted-foreground flex items-center gap-1.5">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span className="text-foreground font-medium text-right">{value}</span>
    </div>
  )
}