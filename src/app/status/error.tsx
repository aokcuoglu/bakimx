"use client"

import { AlertCircle } from "lucide-react"
import { Header } from "@/components/sections/Header"
import { Footer } from "@/components/sections/Footer"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export default function Error({ reset }: { reset: () => void }) {
  return (
    <>
      <Header />
      <main className="mx-auto min-h-[60vh] max-w-2xl space-y-4 px-4 py-12 sm:px-6">
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Sistem durumu yüklenemedi</AlertTitle>
          <AlertDescription>
            Güncel servis bilgileri alınırken bir sorun oluştu. Lütfen biraz sonra yeniden deneyin.
          </AlertDescription>
        </Alert>
        <Button size="lg" onClick={reset}>Yeniden Dene</Button>
      </main>
      <Footer />
    </>
  )
}
