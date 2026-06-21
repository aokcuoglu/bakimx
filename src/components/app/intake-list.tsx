"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Car, ClipboardList } from "lucide-react"
import { INTAKE_STATUS } from "@/lib/constants"

type IntakeWithRelations = {
  id: string
  status: string
  customerComplaint: string
  createdAt: Date
  customer: {
    firstName: string | null
    lastName: string | null
    fullName: string | null
    companyName: string | null
    type: string
  }
  vehicle: { plate: string; brand: string; model: string }
}

export function IntakeList({
  intakes,
}: {
  intakes: IntakeWithRelations[]
}) {
  const searchParams = useSearchParams()
  const currentStatus = searchParams.get("status") || ""

  const statusFilters = [
    { value: "", label: "Tümü" },
    { value: "draft", label: "Taslak" },
    { value: "waiting_approval", label: "Onay bekleniyor" },
    { value: "approved", label: "Onaylandı" },
    { value: "in_progress", label: "İşlemde" },
    { value: "ready_for_delivery", label: "Teslimata hazır" },
    { value: "delivered", label: "Teslim edildi" },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto pb-2">
        {statusFilters.map((f) => {
          const active = currentStatus === f.value
          return (
            <Link
              key={f.value}
              href={f.value ? `/app/intakes?status=${f.value}` : "/app/intakes"}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors touch-manipulation ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {intakes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList className="size-14 mx-auto mb-4 opacity-20" />
          <p className="text-base font-medium">Kabul formu bulunamadı</p>
          <p className="text-sm mt-1">
            {currentStatus ? "Bu durumda kabul kaydı yok" : ""}
          </p>
          <Link href="/app/intakes/new" className="text-primary hover:underline text-sm mt-3 inline-block">
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
                className="flex items-center justify-between p-4 bg-card border rounded-lg hover:bg-muted/50 transition-colors active:bg-muted/70 touch-manipulation"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Car className="size-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {intake.vehicle.plate} - {intake.customer.type === "corporate"
                        ? intake.customer.companyName || "Kurumsal Müşteri"
                        : intake.customer.fullName || `${intake.customer.firstName ?? ""} ${intake.customer.lastName ?? ""}`.trim() || "Müşteri"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {intake.customerComplaint}
                    </p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap shrink-0 ml-2 ${statusInfo?.color || "bg-muted text-muted-foreground"}`}>
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
