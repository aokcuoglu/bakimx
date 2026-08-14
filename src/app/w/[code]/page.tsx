"use server"

import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { WorkshopLoginForm } from "@/components/auth/workshop-login-form"

export const metadata = {
  title: "İş Yeri Girişi",
  description: "İş yerinize özel giriş ekranı",
}

interface Props {
  params: { code: string }
  searchParams: { redirect?: string }
}

export default async function WorkshopLoginPage({ params, searchParams }: Props) {
  const code = params.code.toLowerCase()

  const workshop = await prisma.workshop.findUnique({
    where: { loginCode: code },
    select: {
      id: true,
      name: true,
      logoUrl: true,
    },
  })

  if (!workshop) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
        <div className="text-center">
          <h1 className="text-lg font-bold text-foreground">İş yeri bulunamadı</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Lütfen giriş kodunu kontrol edip tekrar deneyiniz.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          {/* Atölyenin logosu ve adı */}
          {workshop.logoUrl && (
            <div className="mb-8 flex justify-center">
              <img
                src={workshop.logoUrl}
                alt={workshop.name}
                className="max-h-16 max-w-[200px] object-contain"
              />
            </div>
          )}

          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground">{workshop.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Hesabınıza giriş yapın
            </p>
          </div>

          <WorkshopLoginForm workshopCode={code} redirect={searchParams.redirect} />
        </div>
      </div>
    </div>
  )
}
