export const BLOG_CATEGORIES = [
  "operasyon",
  "rehber",
  "urun",
  "sektor",
] as const

export type BlogCategory = (typeof BLOG_CATEGORIES)[number]

export const BLOG_CATEGORY_LABELS: Record<BlogCategory, string> = {
  operasyon: "Operasyon",
  rehber: "Rehber",
  urun: "Ürün",
  sektor: "Sektör",
}

export type BlogAuthor = {
  name: string
  role: string
  /** Optional portrait; otherwise initials are shown. */
  bio?: string
  avatar?: string
}

export type BlogPostMeta = {
  slug: string
  title: string
  description: string
  category: BlogCategory
  publishedAt: string
  updatedAt?: string
  author: BlogAuthor
  cover?: string
  coverAlt?: string
  featured?: boolean
  draft?: boolean
}

export type BlogPost = BlogPostMeta & {
  content: string
}
