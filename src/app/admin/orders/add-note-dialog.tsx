"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { MessageSquarePlus } from "lucide-react"
import { addOrderNote } from "./actions"
import { useToast } from "@/hooks/use-toast"

interface AddNotesDialogProps {
  orderId: string
}

export function AddNoteDialog({ orderId }: AddNotesDialogProps) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async () => {
    if (!note.trim()) {
      toast({
        title: "Hata",
        description: "Not içeriği boş olamaz",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    try {
      const result = await addOrderNote(orderId, note.trim())
      if (result.success) {
        toast({
          title: "Başarılı",
          description: "Not eklendi"
        })
        setNote("")
        setOpen(false)
      } else {
        throw new Error(result.error || "Not eklenemiyor")
      }
    } catch (error) {
      toast({
        title: "Hata",
        description: error instanceof Error ? error.message : "Bilinmeyen hata",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <MessageSquarePlus className="h-4 w-4" />
          Not Ekle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sipariş Notuna Ekle</DialogTitle>
          <DialogDescription>
            Bu sipariş hakkında iç not ekleyin (yalnızca admin tarafı)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            placeholder="Notunuzu yazın..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              İptal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !note.trim()}
            >
              {isLoading ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
