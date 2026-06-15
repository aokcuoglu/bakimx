"use client"

import Link from "next/link"
import {
  Eye,
  Pencil,
  Wrench,
  CalendarClock,
  FileText,
  Archive,
  MoreHorizontal,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type ActionsMenuProps = {
  viewHref: string
  editHref?: string
  workOrderHref?: string
  appointmentHref?: string
  passportHref?: string
  archiveLabel?: string
  onArchive?: () => void
}

export function ActionsMenu({
  viewHref,
  editHref,
  workOrderHref,
  appointmentHref,
  passportHref,
  onArchive,
  archiveLabel,
}: ActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center justify-center size-7 rounded-md hover:bg-slate-100 transition-colors touch-manipulation cursor-pointer">
        <MoreHorizontal className="size-4 text-slate-500" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem>
          <Link href={viewHref} className="flex items-center gap-2 w-full">
            <Eye className="size-4" />
            Görüntüle
          </Link>
        </DropdownMenuItem>
        {editHref && (
          <DropdownMenuItem>
            <Link href={editHref} className="flex items-center gap-2 w-full">
              <Pencil className="size-4" />
              Düzenle
            </Link>
          </DropdownMenuItem>
        )}
        {workOrderHref && (
          <DropdownMenuItem>
            <Link href={workOrderHref} className="flex items-center gap-2 w-full">
              <Wrench className="size-4" />
              İş Emri Oluştur
            </Link>
          </DropdownMenuItem>
        )}
        {appointmentHref && (
          <DropdownMenuItem>
            <Link href={appointmentHref} className="flex items-center gap-2 w-full">
              <CalendarClock className="size-4" />
              Randevu Oluştur
            </Link>
          </DropdownMenuItem>
        )}
        {passportHref && (
          <DropdownMenuItem>
            <Link href={passportHref} className="flex items-center gap-2 w-full">
              <FileText className="size-4" />
              Pasaportu Görüntüle
            </Link>
          </DropdownMenuItem>
        )}
        {onArchive && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onArchive}>
              <Archive className="size-4" />
              {archiveLabel || "Arşivle"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type MobileActionsMenuProps = {
  viewHref: string
  editHref?: string
  workOrderHref?: string
  appointmentHref?: string
  passportHref?: string
  onArchive?: () => void
  archiveLabel?: string
}

export function MobileActionsMenu({
  viewHref,
  editHref,
  workOrderHref,
  appointmentHref,
  passportHref,
  onArchive,
  archiveLabel,
}: MobileActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center justify-center size-8 rounded-md hover:bg-slate-100 transition-colors touch-manipulation cursor-pointer">
        <MoreHorizontal className="size-4 text-slate-500" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem>
          <Link href={viewHref} className="flex items-center gap-2 w-full">
            <Eye className="size-4" />
            Görüntüle
          </Link>
        </DropdownMenuItem>
        {editHref && (
          <DropdownMenuItem>
            <Link href={editHref} className="flex items-center gap-2 w-full">
              <Pencil className="size-4" />
              Düzenle
            </Link>
          </DropdownMenuItem>
        )}
        {workOrderHref && (
          <DropdownMenuItem>
            <Link href={workOrderHref} className="flex items-center gap-2 w-full">
              <Wrench className="size-4" />
              İş Emri Oluştur
            </Link>
          </DropdownMenuItem>
        )}
        {appointmentHref && (
          <DropdownMenuItem>
            <Link href={appointmentHref} className="flex items-center gap-2 w-full">
              <CalendarClock className="size-4" />
              Randevu Oluştur
            </Link>
          </DropdownMenuItem>
        )}
        {passportHref && (
          <DropdownMenuItem>
            <Link href={passportHref} className="flex items-center gap-2 w-full">
              <FileText className="size-4" />
              Pasaportu Görüntüle
            </Link>
          </DropdownMenuItem>
        )}
        {onArchive && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onArchive}>
              <Archive className="size-4" />
              {archiveLabel || "Arşivle"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}