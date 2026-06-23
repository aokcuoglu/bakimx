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
            <Link
              key={action.key}
              href={action.href}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors touch-manipulation"
            >
              <Plus className="size-4" />
              {action.label}
            </Link>
          )
        }
        return (
          <Link
            key={action.key}
            href={action.href}
            className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg border border-border bg-white text-foreground hover:bg-muted text-sm font-medium transition-colors touch-manipulation"
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{action.label}</span>
          </Link>
        )
      })}
    </div>
  )
}

export function orderQuickActions(): QuickAction[] {
  return [
    { key: "new-order", label: "Yeni İş Emri", href: "/orders/new", icon: Wrench, variant: "primary" },
    { key: "new-appointment", label: "Randevu", href: "/appointments/new", icon: CalendarClock, variant: "secondary" },
  ]
}

export function vehicleQuickActions(): QuickAction[] {
  return [
    { key: "new-vehicle", label: "Yeni Araç", href: "/vehicles/new", icon: Car, variant: "primary" },
    { key: "new-order", label: "İş Emri", href: "/orders/new", icon: Wrench, variant: "secondary" },
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
    { key: "new-order", label: "İş Emri", href: "/orders/new", icon: Wrench, variant: "secondary" },
  ]
}

export function quoteQuickActions(): QuickAction[] {
  return [
    { key: "new-quote", label: "Yeni Teklif", href: "/quotes/new", icon: FileText, variant: "primary" },
    { key: "new-order", label: "İş Emri", href: "/orders/new", icon: Wrench, variant: "secondary" },
  ]
}