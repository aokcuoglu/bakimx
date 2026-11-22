import { SiteHeader } from "@/components/marketing/landing/site-header"

/**
 * Giriş gerektirmeyen sayfaların ortak kabuğu (#798). Ana sayfanın üst bandı
 * burada bir kez render edilir: layout'lar istemci geçişlerinde yeniden mount
 * olmadığı için `<Link>` ile gezinirken bant yerinde kalır, yalnız sayfa değişir.
 *
 * Bilinçli olarak grubun dışında: atölyenin müşterisine giden token sayfaları
 * (/p, /s, /w), ödeme akışı (/checkout, /satin-al, /payment), davetler,
 * /admin-login, /design.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  )
}
