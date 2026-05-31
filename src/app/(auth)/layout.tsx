import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Giriş Yap | BakimX",
  description: "BakimX hesabınıza giriş yapın",
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}