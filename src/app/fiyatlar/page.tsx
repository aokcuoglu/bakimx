import Link from "next/link"
import { Header } from "@/components/sections/Header"
import { Footer } from "@/components/sections/Footer"
import { PlanPackages } from "@/components/app/plan-packages"

export const metadata = { title: "Fiyatlar" }

export default function FiyatlarPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-12 space-y-8">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Paketler</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
            İş yerinize uygun paketi seçin. 15 gün ücretsiz denemek için{" "}
            <Link href="/register" className="text-primary hover:underline">kayıt olun</Link>, ya da doğrudan satın alın.
          </p>
        </div>
        <PlanPackages checkoutBasePath="/satin-al" />
      </main>
      <Footer />
    </>
  )
}
