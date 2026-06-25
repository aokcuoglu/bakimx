"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { BrandLogo } from "@/components/shared/brand-logo"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Global 404 sayfası — Next.js'in standart "This page could not be found"
 * ekranının yerine geçer (App Router not-found convention).
 *
 * Oto temalı sıcak metafor: "sayfa rotadan çıkmış". Dekoratif dişli motifi
 * (BrandSpinner) + marka ile tutarlı kart. Giriş animasyonu saf CSS
 * (tw-animate-css) — reduced-motion'a saygılı, framer-motion yükü yok.
 */
export default function NotFound() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-card border border-border rounded-xl p-8 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Dekoratif dişli motifi + 404 rozeti.
              aria-hidden: BrandSpinner içindeki role="status"/"Yükleniyor"
              metni 404 bağlamında yanıltıcı olur; tüm görsel blok gizlenir. */}
          <div className="relative mx-auto mb-6 w-fit" aria-hidden="true">
            <BrandSpinner size={72} />
            <span className="absolute -bottom-1 -right-1 rounded-full bg-navy px-2 py-0.5 text-xs font-bold tracking-wide text-navy-foreground shadow-sm">
              404
            </span>
          </div>

          <h1 className="text-xl font-bold text-foreground mb-2">
            Sayfa rotadan çıkmış
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Aradığınız sayfa taşınmış, silinmiş ya da hiç var olmamış olabilir.
            Sizi tekrar yola çıkaralım.
          </p>

          <div className="flex flex-col gap-2.5">
            <Link
              href="/"
              className={cn(buttonVariants({ size: "xl" }), "w-full")}
            >
              Ana sayfaya dön
            </Link>
            <Button
              variant="outline"
              size="xl"
              className="w-full"
              onClick={() => router.back()}
            >
              Geri dön
            </Button>
          </div>

          <div className="mt-7 flex flex-col items-center gap-1.5 border-t border-border pt-5">
            <BrandLogo variant="icon-light" size="md" />
            <p className="text-xs text-muted-foreground/70">
              BakimX — Dijital Araç Kabul Platformu
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
