import type { MetadataRoute } from "next"
import { getAllPosts } from "@/lib/blog/posts"
import { INDEXABLE_ROUTES, SITE_URL } from "@/lib/seo"

function routePriority(path: string): number {
  if (path === "/") return 1
  if (path === "/oto-servis-programi") return 0.9
  if (
    path === "/is-emri-programi" ||
    path === "/fiyatlar" ||
    path === "/demo" ||
    path === "/contact-us" ||
    path === "/blog"
  ) {
    return 0.8
  }
  if (path === "/dijital-arac-kabul") return 0.7
  if (path.startsWith("/blog/")) return 0.6
  if (path.startsWith("/rehber/") || path.startsWith("/karsilastir/")) return 0.5
  return 0.4
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries = INDEXABLE_ROUTES.map((path) => ({
    url: new URL(path, SITE_URL).toString(),
    changeFrequency: (path === "/" || path === "/blog" ? "weekly" : "monthly") as
      | "weekly"
      | "monthly",
    priority: routePriority(path),
  }))

  const blogEntries = getAllPosts().map((post) => ({
    url: new URL(`/blog/${post.slug}`, SITE_URL).toString(),
    lastModified: new Date(post.updatedAt ?? post.publishedAt),
    changeFrequency: "monthly" as const,
    priority: routePriority(`/blog/${post.slug}`),
  }))

  return [...staticEntries, ...blogEntries]
}
