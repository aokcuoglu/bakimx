import { MessageCircle, Phone, Printer, Share2 } from "lucide-react"
import { buildWorkshopContactEntries, type WorkshopPublicContact } from "@/lib/workshop-contact"

const CHANNEL_ICONS = {
  publicWhatsappNumber: MessageCircle,
  secondaryPhone: Phone,
  faxNumber: Printer,
} as const

/**
 * Atölyenin iletişim / sosyal medya bilgilerini müşteriye açık sayfaların
 * (servis özeti, araç pasaportu) "İş Yeri Bilgileri" bloğunun altına basar.
 *
 * Dolu alan yoksa hiçbir şey render edilmez — boş etiket, boş ikon veya boş
 * ayraç çizgisi kalmaz. Numaralarda etiket görünür kalır (numaranın tek başına
 * WhatsApp mı faks mı olduğu anlaşılmaz); sosyal bağlantılarda görünen metin
 * zaten platformu belli eden adresin kendisidir, böylece kâğıda basıldığında da
 * okunabilir. Dış bağlantılar yeni sekmede ve `noopener noreferrer` ile açılır.
 */
export function WorkshopContactBlock({ contact }: { contact: WorkshopPublicContact | null | undefined }) {
  const { channels, socials } = buildWorkshopContactEntries(contact)
  if (channels.length === 0 && socials.length === 0) return null

  return (
    <div className="pt-2 mt-2 border-t border-border space-y-1.5">
      {channels.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          {channels.map((entry) => {
            const Icon = CHANNEL_ICONS[entry.key as keyof typeof CHANNEL_ICONS] ?? Phone
            return (
              <span key={entry.key} className="inline-flex items-center gap-1.5">
                <Icon className="size-3.5 shrink-0" aria-hidden />
                <span>{entry.label}:</span>
                {entry.href ? (
                  <a
                    href={entry.href}
                    // `tel:` uygulamayı devralır; yeni sekme açmak boş pencere bırakır.
                    {...(entry.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {entry.value}
                  </a>
                ) : (
                  <span>{entry.value}</span>
                )}
              </span>
            )
          })}
        </div>
      )}

      {socials.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          {socials.map((entry) => (
            <span key={entry.key} className="inline-flex items-start gap-1.5 min-w-0">
              <Share2 className="size-3.5 shrink-0 mt-0.5" aria-hidden />
              <a
                href={entry.href ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground break-all"
              >
                <span className="sr-only">{entry.label}: </span>
                {entry.value}
              </a>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
