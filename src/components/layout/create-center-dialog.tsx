"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import { ArrowRight, BellRing, CalendarClock, FileText, LockKeyhole, Plus, Wrench, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { CREATE_OPTIONS } from "@/components/layout/create-center"
import type { GatedFeature } from "@/lib/plan"
import { lockedFeatureLabels } from "@/lib/feature-catalog"

const OPTION_ICONS = {
  order: Wrench,
  quote: FileText,
  appointment: CalendarClock,
  reminder: BellRing,
} as const

const OPTION_FEATURES: Partial<Record<(typeof CREATE_OPTIONS)[number]["id"], GatedFeature>> = {
  quote: "quotes",
  appointment: "appointments",
  reminder: "automatedReminders",
}

export function CreateCenterDialog({
  open,
  onOpenChange,
  enabledFeatures = [],
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  enabledFeatures?: GatedFeature[]
} = {}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next)
    onOpenChange?.(next)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button
            variant="foreground"
            type="button"
            className="w-8 px-0 sm:w-auto sm:px-2.5"
            aria-label="Yeni kayıt oluştur"
            data-tour="create-center"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Oluştur</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          closeButtonRef.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          if (!returnFocusRef.current?.isConnected) return
          event.preventDefault()
          returnFocusRef.current.focus()
        }}
        className="top-auto bottom-0 max-h-[calc(100dvh-1rem)] max-w-none translate-y-0 gap-0 overflow-hidden rounded-b-none bg-card p-0 sm:top-1/2 sm:bottom-auto sm:max-w-2xl sm:-translate-y-1/2 sm:rounded-[var(--radius-dialog)]"
      >
        <DialogHeader className="relative shrink-0 gap-1.5 border-b border-border px-4 py-3 pr-14 sm:px-5 sm:pr-14">
          <DialogTitle className="text-sm leading-5 font-medium text-foreground">
            Ne oluşturmak istiyorsunuz?
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            Bir kayıt türü seçin. Bilgileri bir sonraki ekranda gireceksiniz.
          </DialogDescription>
          <DialogClose asChild>
            <Button
              ref={closeButtonRef}
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-2 right-2 text-muted-foreground"
              aria-label="Oluşturma merkezini kapat"
            >
              <X className="size-4" />
            </Button>
          </DialogClose>
        </DialogHeader>
        <div className="grid min-h-0 gap-2 overflow-y-auto p-4 sm:grid-cols-2 sm:gap-3 sm:p-5" role="list" aria-label="Oluşturulabilecek kayıtlar">
          {CREATE_OPTIONS.map((option) => {
            const Icon = OPTION_ICONS[option.id]
            const feature = OPTION_FEATURES[option.id]
            const locked = Boolean(feature && !enabledFeatures.includes(feature))
            return (
              <div key={option.id} role="listitem">
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-auto min-h-24 w-full items-start justify-start gap-3 whitespace-normal border-border bg-card p-4 text-left shadow-none hover:bg-muted/60 focus-visible:border-ring"
                >
                  <Link href={option.href} onClick={() => setOpen(false)}>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-border bg-muted text-foreground">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                        {option.title}
                        {locked && feature && (
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <LockKeyhole className="size-3" /> {lockedFeatureLabels(feature).badge}
                          </Badge>
                        )}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                    <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </Button>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
