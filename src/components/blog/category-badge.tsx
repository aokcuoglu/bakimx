import { Badge } from "@/components/ui/badge"
import { BLOG_CATEGORY_LABELS, type BlogCategory } from "@/lib/blog/types"
import styles from "./category-badge.module.css"

export function BlogCategoryBadge({ category, className }: { category: BlogCategory; className?: string }) {
  return (
    <Badge variant="outline" className={[styles.badge, className].filter(Boolean).join(" ")} data-category={category} lang="tr">
      {BLOG_CATEGORY_LABELS[category].toLocaleUpperCase("tr-TR")}
    </Badge>
  )
}
