"use client"

import { formatDistanceToNow } from "date-fns"
import { tr } from "date-fns/locale"
import { Card } from "@/components/ui/card"
import { MessageCircle } from "lucide-react"

interface OrderNote {
  id: string
  content: string
  createdAt: Date
  createdBy?: {
    name: string
    email: string
  }
}

interface OrderNotesProps {
  notes: OrderNote[]
}

export function OrderNotes({ notes }: OrderNotesProps) {
  if (notes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
        <MessageCircle className="h-5 w-5 opacity-50" />
        <p>Henüz not bulunmamaktadır</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <Card key={note.id} className="p-4">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {note.createdBy?.name || "Yönetici"}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(note.createdAt), {
                  addSuffix: true,
                  locale: tr
                })}
              </p>
            </div>
          </div>
          <p className="text-sm whitespace-pre-wrap break-words text-foreground">
            {note.content}
          </p>
        </Card>
      ))}
    </div>
  )
}
