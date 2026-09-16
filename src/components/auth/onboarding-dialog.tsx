"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { RegisterForm } from "@/components/auth/register-form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/** Layouts persist during client navigation, so keep their pending content on dashboard. */
export function OnboardingRouteContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (pathname !== "/dashboard") router.replace("/dashboard")
  }, [pathname, router])

  return pathname === "/dashboard" ? children : null
}

export function OnboardingDialog() {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  return (
    <Dialog open>
      <DialogContent
        ref={contentRef}
        showCloseButton={false}
        overlayClassName="bg-background/60 supports-backdrop-filter:backdrop-blur-sm"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          titleRef.current?.focus()
        }}
        className="max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] gap-0 p-4 shadow-lg sm:max-w-4xl sm:p-7"
      >
        <DialogHeader className="mb-5 border-b border-border pb-4">
          <DialogTitle ref={titleRef} tabIndex={-1} className="text-lg outline-none">Servisinizi hazırlayın</DialogTitle>
          <DialogDescription>
            Dört kısa adımı tamamladığınızda paneliniz kullanıma açılacak.
          </DialogDescription>
        </DialogHeader>
        <RegisterForm
          mode="onboarding"
          onStepChange={() => contentRef.current?.scrollTo({ top: 0, behavior: "instant" })}
        />
      </DialogContent>
    </Dialog>
  )
}
