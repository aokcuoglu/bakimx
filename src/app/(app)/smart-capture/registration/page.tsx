import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import { SmartCaptureRegistration } from "@/components/app/smart-capture-registration"
import Link from "next/link"
import { ArrowLeft, ScanLine } from "lucide-react"

export default async function SmartCaptureRegistrationPage() {
  const { workshop } = await getAppData()

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Ruhsat Okuma" showGlobalSearch={false}>
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-3.5" />
            Panel
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Ruhsat Okuma</span>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <ScanLine className="size-6 text-primary" />
            Ruhsat Okuma
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Araç ruhsat fotoğrafını yükleyin veya çekin, sistem otomatik okusun
          </p>
        </div>

        <SmartCaptureRegistration />
      </div>
    </AppShell>
  )
}