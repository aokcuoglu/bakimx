"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function InstantLink({
  href,
  className,
  children,
  pendingLabel = "Açılıyor",
}: {
  href: string
  className?: string
  children: React.ReactNode
  pendingLabel?: string
}) {
  const [pending, setPending] = useState(false)
  return (
    <Link
      href={href}
      prefetch
      className={cn(className, pending && "opacity-70")}
      aria-busy={pending || undefined}
      onClick={() => setPending(true)}
    >
      {children}
      {pending ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-label={pendingLabel} />
      ) : null}
    </Link>
  )
}
