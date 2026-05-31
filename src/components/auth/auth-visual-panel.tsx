"use client"

import Image from "next/image"
import { motion } from "framer-motion"

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
      className="relative flex flex-col justify-between h-full min-h-[280px] lg:min-h-full overflow-hidden bg-gradient-to-br from-[#0B1F3A] to-[#102A43]"
    >
      <div
        className="absolute inset-0 bg-cover bg-center opacity-40"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=900&q=80')",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#0B1F3A]/90 via-[#0B1F3A]/70 to-[#102A43]/60" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0B1F3A] via-transparent to-transparent" />

      <div className="relative z-10 flex flex-col justify-between h-full p-8 lg:p-10 xl:p-12">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-sm ring-1 ring-white/20 p-1.5">
            <Image src="/logo.svg" alt="BakimX" width={40} height={40} className="size-full" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">BakimX</span>
        </div>

        <motion.div
          variants={contentVariants}
          initial="hidden"
          animate="visible"
          className="space-y-5"
        >
          <div className="w-12 h-0.5 bg-[#38BDF8]/60 rounded-full" />
          <blockquote className="text-lg lg:text-xl font-medium text-white leading-relaxed">
            &ldquo;Servis kabul sürecini daha düzenli ve profesyonel yönetiyoruz.&rdquo;
          </blockquote>
          <div className="space-y-1">
            <p className="text-sm font-medium text-white/90">Demo Kullanıcı Görüşü</p>
            <p className="text-sm text-[#38BDF8]/80">Özel Servis İşletmesi</p>
          </div>
          <p className="text-sm text-white/60 leading-relaxed max-w-xs">
            BakimX ile araç kabul, hasar kaydı ve müşteri onayı tek akışta yönetilir.
          </p>
        </motion.div>
      </div>
    </motion.div>
  )
}
