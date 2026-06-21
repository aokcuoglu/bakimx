import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "İş Yeri Paneli",
  description: "Araç kabul, hasar kaydı ve müşteri onayı yönetimi",
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1">{children}</div>
      <div className="border-t py-2 px-4 text-center text-xs text-muted-foreground">
        v{process.env.NEXT_PUBLIC_APP_VERSION}
      </div>
    </div>
  )
}