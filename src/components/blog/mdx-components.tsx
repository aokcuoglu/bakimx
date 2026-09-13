import Link from "next/link"
import type { MDXComponents } from "mdx/types"

export const blogMdxComponents: MDXComponents = {
  a: ({ href, children, ...props }) => {
    if (!href) return <a {...props}>{children}</a>
    if (href.startsWith("/")) {
      return (
        <Link href={href} {...props}>
          {children}
        </Link>
      )
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    )
  },
}
