import type { MetadataRoute } from "next"
import { SITE_URL } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/checkout",
        "/dashboard",
        "/destek/",
        "/forgot-password",
        "/invite/",
        "/login",
        "/p/",
        "/payment/",
        "/register",
        "/reset-password/",
        "/s/",
        "/satin-al",
        "/w/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
