"use client"

import Link from "next/link"
import { useState } from "react"
import { BellRing, CalendarClock, FileText, Plus, Wrench, X } from "lucide-react"
import { Button } from "@/components/ui/button"
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

const OPTION_ICONS = {
  order: Wrench,
  quote: FileText,
  appointment: CalendarClock,
  reminder: BellRing,
} as const

export function CreateCenterDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className="w-8 px-0 sm:w-auto sm:px-2.5" aria-label="Yeni kayıt oluştur">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Oluştur</span>
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="top-auto bottom-0 max-h-[calc(100dvh-1rem)] max-w-none translate-y-0 overflow-y-auto rounded-b-none sm:top-1/2 sm:bottom-auto sm:max-w-xl sm:-translate-y-1/2 sm:rounded-xl">
        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="absolute top-1 right-1 md:top-2 md:right-2"
            aria-label="Oluşturma merkezini kapat"
          >
            <X className="size-5" />
          </Button>
        </DialogClose>
        <DialogHeader>
          <DialogTitle>Ne oluşturmak istiyorsunuz?</DialogTitle>
          <DialogDescription>
            Bir kayıt türü seçin. Bilgileri bir sonraki ekranda gireceksiniz.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2" role="list" aria-label="Oluşturulabilecek kayıtlar">
          {CREATE_OPTIONS.map((option) => {
            const Icon = OPTION_ICONS[option.id]
            return (
              <div key={option.id} role="listitem">
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-auto min-h-16 w-full justify-start gap-3 whitespace-normal p-3 text-left md:min-h-16"
                >
                  <Link href={option.href} onClick={() => setOpen(false)}>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground">{option.title}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
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
