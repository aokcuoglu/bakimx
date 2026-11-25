"use client"

import { useState } from "react"
import { Check, Copy, Link2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export function ReferralShare({ referralUrl, referralCode }: { referralUrl: string; referralCode: string }) {
  const [copied, setCopied] = useState<"link" | "message" | null>(null)
  const message = `Merhaba, iş yerimizde BakımX kullanıyoruz. Bu bağlantıyla kaydolursanız tüm ücretli paketlerde ilk yıl %10 indirim kazanırsınız: ${referralUrl} Referans kodumuz: ${referralCode}`

  async function copy(value: string, kind: "link" | "message") {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
      toast.success(kind === "link" ? "Davet bağlantısı kopyalandı." : "Davet mesajı kopyalandı.")
    } catch {
      toast.error("Kopyalanamadı. Metni seçip kopyalayabilirsiniz.")
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input aria-label="Davet bağlantısı" value={referralUrl} readOnly onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1" />
        <Button type="button" variant="default" size="sm" onClick={() => copy(referralUrl, "link")}>
          {copied === "link" ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
          Bağlantıyı kopyala
        </Button>
      </div>

      <div className="my-7 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <span>veya bir mesajla paylaşın</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Textarea aria-label="Davet mesajı" value={message} readOnly onFocus={(event) => event.currentTarget.select()} className="min-h-16 resize-none" />
      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => copy(message, "message")}>
        {copied === "message" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        Mesajı kopyala
      </Button>
    </div>
  )
}
