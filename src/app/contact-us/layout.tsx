import type { Metadata } from "next"
import { publicPageMetadata } from "@/lib/seo"

export const metadata: Metadata = publicPageMetadata({
  path: "/contact-us",
  title: "İletişim",
  description: "BakımX ekibiyle iletişime geçin. Sorularınızı ve servisinizin ihtiyaçlarını bize iletin.",
})

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
