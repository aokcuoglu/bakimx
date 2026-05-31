import Link from "next/link"
import { Car, ClipboardList } from "lucide-react"
import { INTAKE_STATUS } from "@/lib/constants"

type IntakeWithRelations = {
  id: string
  status: string
  customerComplaint: string
  createdAt: Date
  customer: { firstName: string; lastName: string }
  vehicle: { plate: string; brand: string; model: string }
}

export function IntakeList({
  intakes,
}: {
  intakes: IntakeWithRelations[]
}) {
  const statusFilters = [
    { value: "", label: "Tümü" },
    { value: "draft", label: "Taslak" },
    { value: "waiting_approval", label: "Onay bekleniyor" },
    { value: "approved", label: "Onaylandı" },
    { value: "in_progress", label: "İşlemde" },
    { value: "ready_for_delivery", label: "Teslimat için hazır" },
    { value: "delivered", label: "Teslim edildi" },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {statusFilters.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/app/intakes?status=${f.value}` : "/app/intakes"}
            className="whitespace-nowrap"
          >
            <span className="text-sm text-primary hover:underline">{f.label}</span>
          </Link>
        ))}
      </div>

      {intakes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardList className="size-12 mx-auto mb-3 opacity-30" />
          <p>Kabul formu bulunamadı</p>
          <Link href="/app/intakes/new" className="text-primary hover:underline text-sm mt-1 block">
            Yeni araç kabulü başlatın
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {intakes.map((intake) => {
            const statusInfo = INTAKE_STATUS[intake.status as keyof typeof INTAKE_STATUS]
            return (
              <Link
                key={intake.id}
                href={`/app/intakes/${intake.id}`}
                className="flex items-center justify-between p-3 bg-card border rounded-xl hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Car className="size-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">
                      {intake.vehicle.plate} - {intake.customer.firstName} {intake.customer.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {intake.customerComplaint}
                    </p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${statusInfo?.color || "bg-gray-100 text-gray-800"}`}>
                  {statusInfo?.label || intake.status}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}