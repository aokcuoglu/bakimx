"use client"

import Link from "next/link"
import {
  Plus,
  Wrench,
  CalendarClock,
  Car,
  Users,
  FileText,
} from "lucide-react"

import { Button } from "@/components/ui/button"

type QuickAction = {
  key: string
  label: string
  href: string
  icon: LucideIcon
  variant: "primary" | "secondary"
}

import type { LucideIcon } from "lucide-react"

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => {
        const Icon = action.icon
        if (action.variant === "primary") {
          return (
            <Button
              key={action.key}
              nativeButton={false}
              size="lg"
              className="touch-manipulation"
              render={<Link href={action.href} />}
            >
              <Plus className="size-4" />
              {action.label}
            </Button>
          )
        }
        return (
          <Button
            key={action.key}
            nativeButton={false}
            variant="outline"
            size="lg"
            className="touch-manipulation"
            render={<Link href={action.href} />}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{action.label}</span>
          </Button>
        )
      })}
    </div>
  )
}

export function orderQuickActions(): QuickAction[] {
  return [
    { key: "new-order", label: "Yeni İş Emri", href: "/intakes/new", icon: Wrench, variant: "primary" },
    { key: "new-appointment", label: "Randevu", href: "/appointments/new", icon: CalendarClock, variant: "secondary" },
  ]
}

export function vehicleQuickActions(): QuickAction[] {
  return [
    { key: "new-vehicle", label: "Yeni Araç", href: "/vehicles/new", icon: Car, variant: "primary" },
    { key: "new-order", label: "İş Emri", href: "/intakes/new", icon: Wrench, variant: "secondary" },
  ]
}

export function customerQuickActions(): QuickAction[] {
  return [
    { key: "new-customer", label: "Yeni Müşteri", href: "/customers/new", icon: Users, variant: "primary" },
    { key: "new-appointment", label: "Randevu", href: "/appointments/new", icon: CalendarClock, variant: "secondary" },
  ]
}

export function appointmentQuickActions(): QuickAction[] {
  return [
    { key: "new-appointment", label: "Yeni Randevu", href: "/appointments/new", icon: CalendarClock, variant: "primary" },
    { key: "new-order", label: "İş Emri", href: "/intakes/new", icon: Wrench, variant: "secondary" },
  ]
}

export function quoteQuickActions(): QuickAction[] {
  return [
    { key: "new-quote", label: "Yeni Teklif", href: "/quotes/new", icon: FileText, variant: "primary" },
    { key: "new-order", label: "İş Emri", href: "/intakes/new", icon: Wrench, variant: "secondary" },
  ]
}