"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { BrandLogo } from "@/components/shared/brand-logo"

const panelVariants = {
  hidden: { opacity: 0, x: -30 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
}

const contentVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.3, ease: "easeOut" as const } },
}

export function AuthVisualPanel() {
  return (
    <motion.div
      variants={panelVariants}
      initial="hidden"
      animate="visible"
      className="relative flex flex-col justify-between h-full min-h-[280px] lg:min-h-full overflow-hidden bg-navy text-navy-foreground"
    >
      {/* satın-al BrandRail ile aynı: yumuşak navy gradient + ışık (foto yok) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-navy via-navy to-navy-light" />
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-primary/25 blur-3xl" />
      <Image
        src="/04-bakimx-icon-dark.svg"
        alt=""
        width={303}
        height={190}
        priority
        unoptimized
        className="absolute bottom-0 right-0 w-48 lg:w-64 h-auto opacity-[0.08] pointer-events-none select-none"
        aria-hidden
      />

      <div className="relative z-10 flex flex-col justify-between h-full p-8 lg:p-10 xl:p-12 items-start">
        <Link href="/" aria-label="BakimX ana sayfa">
          <BrandLogo variant="primary-dark" size="lg" priority alt="BakimX" />
        </Link>

        <motion.div
          variants={contentVariants}
          initial="hidden"
          animate="visible"
          className="space-y-5"
        >
          <div className="w-16 h-1 bg-brand rounded-full" />
          <blockquote className="text-xl lg:text-2xl font-medium text-white leading-relaxed">
            &ldquo;Servis kabul sürecini daha düzenli ve profesyonel yönetiyoruz.&rdquo;
          </blockquote>
          <div className="space-y-1">
            <p className="text-sm font-medium text-white/90">Demo Kullanıcı Görüşü</p>
            <p className="text-sm font-medium text-brand">Özel Servis İşletmesi</p>
          </div>
          <p className="text-sm text-white/70 leading-relaxed max-w-xs">
            BakimX ile araç kabul, hasar kaydı ve müşteri onayı tek akışta yönetilir.
          </p>
        </motion.div>
      </div>
    </motion.div>
  )
}