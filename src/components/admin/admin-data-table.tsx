import type { ReactNode } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/shared/empty-state"
import { TableProperties } from "lucide-react"

/** Shared, deliberately small server-data table. Filtering and pagination stay
 * in the page's URL/server query; this component only standardises the surface. */
export function AdminDataTable<Row>({
  columns,
  rows,
  renderRow,
  empty,
}: {
  columns: string[]
  rows: Row[]
  renderRow: (row: Row) => ReactNode
  empty: { title: string; description?: string }
}) {
  if (rows.length === 0) return <EmptyState icon={TableProperties} title={empty.title} description={empty.description} />
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader><TableRow>{columns.map((column) => <TableHead key={column}>{column}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{rows.map(renderRow)}</TableBody>
      </Table>
    </div>
  )
}

export function AdminDataCell({ children, className }: { children: ReactNode; className?: string }) {
  return <TableCell className={className}>{children}</TableCell>
}
