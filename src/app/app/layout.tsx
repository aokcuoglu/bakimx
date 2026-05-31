import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "BakimX | İş Yeri Paneli",
  description: "Araç kabul, hasar kaydı ve müşteri onayı yönetimi",
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>
}