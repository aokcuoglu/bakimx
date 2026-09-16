import Image from "next/image"
import Link from "next/link"
import { AlertCircle, Info, Lightbulb } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { GuideBlock } from "@/lib/guide/kilavuz"
import styles from "@/components/guide/kilavuz.module.css"

function Callout({
  variant,
  title,
  text,
  icon: Icon,
}: {
  variant: "info" | "warning" | "default"
  title?: string
  text: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Alert variant={variant === "default" ? "default" : variant}>
      <Icon />
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  )
}

export function GuideBlocks({ blocks }: { blocks: GuideBlock[] }) {
  return (
    <div className={styles.prose}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`
        switch (block.type) {
          case "p":
            return <p key={key}>{block.text}</p>
          case "ol":
            return (
              <ol key={key}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            )
          case "ul":
            return (
              <ul key={key}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )
          case "tip":
            return (
              <Callout key={key} variant="default" title={block.title ?? "İpucu"} text={block.text} icon={Lightbulb} />
            )
          case "warning":
            return (
              <Callout key={key} variant="warning" title={block.title ?? "Dikkat"} text={block.text} icon={AlertCircle} />
            )
          case "note":
            return (
              <Callout key={key} variant="default" title={block.title ?? "Not"} text={block.text} icon={Info} />
            )
          case "shot":
            return (
              <figure key={key} className={styles.shot}>
                {block.src ? (
                  <Image src={block.src} alt={block.alt} width={1200} height={720} className="w-full h-auto" />
                ) : (
                  <div className={styles.shotFrame} role="img" aria-label={block.alt}>
                    Ekran görüntüsü yakında
                    <span className="sr-only">{block.alt}</span>
                  </div>
                )}
                <figcaption>{block.caption}</figcaption>
              </figure>
            )
          case "table":
            return (
              <div key={key} className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {block.headers.map((header) => (
                        <th key={header} scope="col">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row) => (
                      <tr key={row.join("|")}>
                        {row.map((cell) => (
                          <td key={cell}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case "links":
            return (
              <div key={key} className={styles.links}>
                {block.items.map((item, i) => (
                  <Button key={item.href} asChild variant={i === 0 ? "navy" : "outline"} size="sm">
                    <Link href={item.href}>{item.label}</Link>
                  </Button>
                ))}
              </div>
            )
          default:
            return null
        }
      })}
    </div>
  )
}
