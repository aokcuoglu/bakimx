import type { Metadata } from "next"
import localFont from "next/font/local"
import { publicPageMetadata, TITLE_TEMPLATE } from "@/lib/seo"

const blogFont = localFont({
  src: [
    { path: "./fonts/Switzer-Variable.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/Switzer-VariableItalic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-blog",
  display: "swap",
})

const base = publicPageMetadata({
  path: "/blog",
  brandFirst: true,
  title: "Blog: Servis Yönetimi ve Rehberler",
  description: "BakımX blog: oto servis operasyonu, dijital araç kabul, iş emri ve atölye yazılımı üzerine rehberler.",
})

export const metadata: Metadata = {
  ...base,
  title: { absolute: "BakımX Blog: Servis Yönetimi ve Rehberler", template: TITLE_TEMPLATE },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className={`${blogFont.variable} ${blogFont.className}`}>{children}</div>
}
