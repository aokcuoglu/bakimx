import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PublicSite } from "@/components/public/PublicSite"
import { Header } from "@/components/sections/Header"
import { Footer } from "@/components/sections/Footer"
import { BlogArticle } from "@/components/sections/BlogArticle"
import { JsonLd } from "@/components/seo/json-ld"
import { getPostBySlug, getPostSlugs } from "@/lib/blog/posts"
import { publicPageMetadata, SITE_URL } from "@/lib/seo"

type PageProps = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }))
}

export const dynamicParams = false

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return {}

  const base = publicPageMetadata({
    path: `/blog/${post.slug}`,
    title: post.title,
    description: post.description,
    image: post.cover ? { url: post.cover, alt: post.coverAlt } : undefined,
  })

  return {
    ...base,
    openGraph: {
      ...base.openGraph,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      authors: [post.author.name],
    },
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  const articleStructuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    url: `${SITE_URL}/blog/${post.slug}`,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: {
      "@type": "Person",
      name: post.author.name,
      jobTitle: post.author.role,
    },
    publisher: {
      "@type": "Organization",
      name: "BakımX",
      url: SITE_URL,
    },
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
    image: post.cover ? `${SITE_URL}${post.cover}` : undefined,
    inLanguage: "tr-TR",
  }

  return (
    <PublicSite customLayout>
      <JsonLd data={articleStructuredData} />
      <Header />
      <BlogArticle post={post} />
      <Footer />
    </PublicSite>
  )
}
