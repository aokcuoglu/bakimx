import { PublicSite } from "@/components/public/PublicSite"
import { Header } from "@/components/sections/Header"
import { Footer } from "@/components/sections/Footer"
import { ContactPage } from "@/components/sections/ContactPage"

export default function ContactUsPage() {
  return <PublicSite><Header /><ContactPage /><Footer /></PublicSite>
}
