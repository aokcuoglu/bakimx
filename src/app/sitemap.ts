import type { MetadataRoute } from "next"
import { INDEXABLE_ROUTES, SITE_URL } from "@/lib/seo"

export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXABLE_ROUTES.map((path) => ({
    url: new URL(path, SITE_URL).toString(),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority:
      path === "/"
        ? 1
        : path === "/oto-servis-programi"
          ? 0.9
          : path === "/is-emri-programi" || path === "/fiyatlar" || path === "/demo"
            ? 0.8
            : path === "/dijital-arac-kabul"
              ? 0.7
              : path.startsWith("/rehber/") || path.startsWith("/karsilastir/")
                ? 0.5
                : 0.4,
  }))
}
