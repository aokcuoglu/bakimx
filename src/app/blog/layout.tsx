import type { Metadata } from "next"
import { Schibsted_Grotesk } from "next/font/google"
import { publicPageMetadata, TITLE_TEMPLATE } from "@/lib/seo"

const blogFont = Schibsted_Grotesk({
  variable: "--font-blog",
  subsets: ["latin", "latin-ext"],
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
