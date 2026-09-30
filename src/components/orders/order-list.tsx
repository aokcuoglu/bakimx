"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronDown, FileWarning } from "lucide-react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"

import { StatusBadge, PlateBadge } from "@/components/shared/status-badge"
import { OrderTableColumnHeader } from "@/components/orders/order-table-column-header"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ActionsMenu, MobileActionsMenu } from "@/components/shared/actions-menu"
import { StatCard } from "@/components/shared/stat-card"
import { TechnicianAssign, type AssignableTechnician } from "@/components/orders/technician-assign"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatTRY } from "@/lib/format"
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants"
import { matchesColumnFilter, ORDER_LIST_COLUMN_LABELS, ORDER_LIST_DATA_COLUMN_ORDER } from "@/lib/orders/list-columns"
import { isOrderLocked } from "@/lib/status-transitions"
import type { OrderStatus } from "@prisma/client"
import { ACTIVE_ORDER_FILTER } from "@/lib/orders/status-filter"

type OrderRow = {
  id: string
  workOrderNo: string
  status: string
  paymentStatus: string
  technicianName: string | null
  assignedTechnicianId: string | null
  assignedTechnicianName: string | null
  estimatedDeliveryAt: string | null
  createdAt: string
  grandTotal: number
  itemsCount: number
  hasPrice: boolean
  invoiceNo: string | null
  /** Fatura beklenen statüde numara girilmemiş — sunucuda hesaplanır. */
  invoiceMissing: boolean
  vehicle: { plate: string; brand: string; model: string; id?: string }
  customer: {
    id?: string
    firstName: string | null
    lastName: string | null
    fullName: string | null
    companyName: string | null
    type: string
    phone: string
  }
}

type KPIs = {
  active: number
  completed: number
  delivered: number
  cancelled: number
  waitingApproval: number
}

type KpiConfig = {
  key: keyof KPIs
  label: string
  count: number
  filterValue: string
  accent: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function customerName(c: OrderRow["customer"]): string {
  if (c.type === "corporate") return c.companyName || "Kurumsal Müşteri"
  return c.fullName || `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "Müşteri"
}

function statusSearch(order: OrderRow): string {
  const status = ORDER_STATUS[order.status as keyof typeof ORDER_STATUS]?.label ?? order.status
  return status
}

function invoiceSearch(order: OrderRow): string {
  const value = (order.invoiceNo || "").trim()
  if (value) return value
  return order.invoiceMissing ? "Fatura yok" : ""
}

function technicianSearch(order: OrderRow): string {
  return order.assignedTechnicianName?.trim() || "Atanmamış"
}

function textFilter<T>(read: (row: T) => string) {
  return (row: { original: T }, _columnId: string, value: unknown) =>
    matchesColumnFilter(read(row.original), value)
}

function PaymentText({ status }: { status: string }) {
  const label = PAYMENT_STATUS[status as keyof typeof PAYMENT_STATUS]?.label ?? status
  const tone = status === "paid" ? "bg-success" : status === "partial" ? "bg-warning" : "bg-border"
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
      <span className={`size-1.5 shrink-0 rounded-full ${tone}`} aria-hidden="true" />
      {label}
    </span>
  )
}

/** Supporting information stays available on hover and keyboard focus. */
function DetailHint({ children, detail }: { children: React.ReactNode; detail: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="block w-fit max-w-full rounded-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={detail}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{detail}</TooltipContent>
    </Tooltip>
  )
}

/** Missing invoice remains a single line, without a second status badge. */
function InvoiceMissingBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-warning-strong"
    >
      <FileWarning className="size-3.5" aria-hidden="true" />
      Fatura yok
    </span>
  )
}

function InvoiceCell({ invoiceNo, missing }: { invoiceNo: string | null; missing: boolean }) {
  const value = (invoiceNo || "").trim()
  if (value) {
    return (
      <DetailHint detail={value}>
        <span className="block max-w-28 truncate font-mono text-xs text-foreground">{value}</span>
      </DetailHint>
    )
  }
  if (!missing) return <span className="text-muted-foreground">—</span>
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-xs outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <InvoiceMissingBadge />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">Fatura numarası girilmemiş</TooltipContent>
    </Tooltip>
  )
}

export function OrderList({
  orders,
  kpis,
  activeStatus,
  activePayment,
  activeTechnician = "",
  activeInvoice = "",
  technicians = [],
}: {
  orders: OrderRow[]
  kpis: KPIs
  activeStatus: string
  activePayment: string
  activeTechnician?: string
  activeInvoice?: string
  technicians?: AssignableTechnician[]
}) {
  const kpiConfigs: KpiConfig[] = [
    { key: "active", label: "Aktif", count: kpis.active, filterValue: ACTIVE_ORDER_FILTER, accent: "bg-primary/10 text-primary-strong border-primary/20" },
    { key: "waitingApproval", label: "Onay Bekliyor", count: kpis.waitingApproval, filterValue: "waiting_approval", accent: "bg-warning/10 text-warning-strong border-warning/20" },
    { key: "completed", label: "Tamamlandı", count: kpis.completed, filterValue: "ready_for_delivery", accent: "bg-primary/10 text-primary-strong border-primary/20" },
    { key: "delivered", label: "Teslim Edildi", count: kpis.delivered, filterValue: "delivered", accent: "bg-success/10 text-success-strong border-success/20" },
    { key: "cancelled", label: "İptal", count: kpis.cancelled, filterValue: "cancelled", accent: "bg-destructive/10 text-destructive-strong border-destructive/20" },
  ]

  // KPI kartına tıklamak yalnız durumu değiştirmeli; diğer aktif filtreler korunur.
  const keptFilters = [
    activePayment ? `payment=${activePayment}` : "",
    activeTechnician ? `technician=${encodeURIComponent(activeTechnician)}` : "",
    activeInvoice ? `invoice=${encodeURIComponent(activeInvoice)}` : "",
  ].filter(Boolean)

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({ delivery: false })

  const columns = useMemo<ColumnDef<OrderRow>[]>(() => {
    const byId: Record<(typeof ORDER_LIST_DATA_COLUMN_ORDER)[number], ColumnDef<OrderRow>> = {
      workOrderNo: {
        id: "workOrderNo",
        accessorFn: (order) => order.workOrderNo,
        header: ({ column }) => <OrderTableColumnHeader column={column} title="İş No" />,
        filterFn: textFilter((order) => order.workOrderNo),
        cell: ({ row }) => (
          <Link
            href={`/orders/${row.original.id}`}
            className="font-mono text-xs font-medium text-foreground hover:text-primary transition-colors"
          >
            {row.original.workOrderNo}
          </Link>
        ),
      },
      vehicle: {
        id: "vehicle",
        accessorFn: (order) => `${order.vehicle.plate} ${order.vehicle.brand} ${order.vehicle.model}`,
        header: ({ column }) => <OrderTableColumnHeader column={column} title="Araç" />,
        filterFn: textFilter((order) => `${order.vehicle.plate} ${order.vehicle.brand} ${order.vehicle.model}`),
        cell: ({ row }) => {
          const order = row.original
          return (
            <DetailHint detail={`${order.vehicle.plate} · ${order.vehicle.brand} ${order.vehicle.model}`}>
              {order.vehicle.id ? (
                <Link href={`/vehicles/${order.vehicle.id}`}>
                  <PlateBadge plate={order.vehicle.plate} size="sm" />
                </Link>
              ) : (
                <PlateBadge plate={order.vehicle.plate} size="sm" />
              )}
            </DetailHint>
          )
        },
      },
      customer: {
        id: "customer",
        accessorFn: (order) => `${customerName(order.customer)} ${order.customer.phone}`,
        header: ({ column }) => <OrderTableColumnHeader column={column} title="Müşteri" />,
        filterFn: textFilter((order) => `${customerName(order.customer)} ${order.customer.phone}`),
        cell: ({ row }) => {
          const order = row.original
          const name = customerName(order.customer)
          return (
            <DetailHint detail={`${name} · ${order.customer.phone}`}>
              {order.customer.id ? (
                <Link href={`/customers/${order.customer.id}`} className="block max-w-[11rem] truncate font-medium text-foreground transition-colors hover:text-primary">
                  {name}
                </Link>
              ) : (
                <span className="block max-w-[11rem] truncate font-medium text-foreground">{name}</span>
              )}
            </DetailHint>
          )
        },
      },
      status: {
        id: "status",
        accessorFn: statusSearch,
        header: ({ column }) => <OrderTableColumnHeader column={column} title="Durum" />,
        filterFn: textFilter(statusSearch),
        cell: ({ row }) => (
          <StatusBadge status={row.original.status} />
        ),
      },
      payment: {
        id: "payment",
        accessorFn: (order) => PAYMENT_STATUS[order.paymentStatus as keyof typeof PAYMENT_STATUS]?.label ?? order.paymentStatus,
        header: ({ column }) => <OrderTableColumnHeader column={column} title="Ödeme" />,
        filterFn: textFilter((order) => PAYMENT_STATUS[order.paymentStatus as keyof typeof PAYMENT_STATUS]?.label ?? order.paymentStatus),
        cell: ({ row }) => <PaymentText status={row.original.paymentStatus} />,
      },
      invoice: {
        id: "invoice",
        accessorFn: invoiceSearch,
        header: ({ column }) => <OrderTableColumnHeader column={column} title="Fatura" />,
        filterFn: textFilter(invoiceSearch),
        cell: ({ row }) => <InvoiceCell invoiceNo={row.original.invoiceNo} missing={row.original.invoiceMissing} />,
      },
      total: {
        id: "total",
        accessorFn: (order) => (order.hasPrice ? order.grandTotal : null),
        sortingFn: (a, b) => {
          const left = a.original.hasPrice ? a.original.grandTotal : Number.NEGATIVE_INFINITY
          const right = b.original.hasPrice ? b.original.grandTotal : Number.NEGATIVE_INFINITY
          return left - right
        },
        header: ({ column }) => <OrderTableColumnHeader column={column} title="Toplam" align="right" />,
        filterFn: textFilter((order) => (order.hasPrice ? formatTRY(order.grandTotal) : "")),
        meta: { align: "right" },
        cell: ({ row }) => (
          <div className="text-right font-semibold text-foreground tabular-nums whitespace-nowrap">
            {row.original.hasPrice ? formatTRY(row.original.grandTotal) : <span className="text-muted-foreground font-normal">—</span>}
          </div>
        ),
      },
      dates: {
        id: "dates",
        accessorFn: (order) => order.createdAt,
        header: ({ column }) => <OrderTableColumnHeader column={column} title="Giriş tarihi" />,
        filterFn: textFilter((order) => formatDate(order.createdAt)),
        cell: ({ row }) => <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
      },
      delivery: {
        id: "delivery",
        accessorFn: (order) => order.estimatedDeliveryAt,
        sortUndefined: "last",
        header: ({ column }) => <OrderTableColumnHeader column={column} title="Tahmini teslim" />,
        filterFn: textFilter((order) => order.estimatedDeliveryAt ? formatDate(order.estimatedDeliveryAt) : ""),
        cell: ({ row }) => <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{row.original.estimatedDeliveryAt ? formatDate(row.original.estimatedDeliveryAt) : "—"}</span>,
      },
      technician: {
        id: "technician",
        accessorFn: technicianSearch,
        header: ({ column }) => <OrderTableColumnHeader column={column} title="Teknisyen" />,
        filterFn: textFilter(technicianSearch),
        cell: ({ row }) => (
          <TechnicianAssign
            orderId={row.original.id}
            assignedTechnicianId={row.original.assignedTechnicianId}
            assignedTechnicianName={row.original.assignedTechnicianName}
            technicians={technicians}
            locked={isOrderLocked(row.original.status as OrderStatus)}
            size="sm"
            variant="meta"
          />
        ),
      },
    }

    return [
      ...ORDER_LIST_DATA_COLUMN_ORDER.map((id) => byId[id]),
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        enableColumnFilter: false,
        header: () => <span className="text-xs font-medium text-muted-foreground">İşlem</span>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end">
            <ActionsMenu
              viewHref={`/orders/${row.original.id}`}
              editHref={
                isOrderLocked(row.original.status as OrderStatus)
                  ? undefined
                  : `/orders/${row.original.id}?edit=1`
              }
            />
          </div>
        ),
      },
    ]
  }, [technicians])

  const table = useReactTable({
    data: orders,
    columns,
    state: { sorting, columnFilters, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (order) => order.id,
  })

  const visibleOrders = table.getRowModel().rows.map((row) => row.original)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {kpiConfigs.map((cfg) => {
          const isActive = activeStatus === cfg.filterValue
          const parts = isActive ? keptFilters : [`status=${cfg.filterValue}`, ...keptFilters]
          const href = parts.length > 0 ? `/orders?${parts.join("&")}` : "/orders"
          return (
            <StatCard
              key={cfg.key}
              label={cfg.label}
              value={cfg.count}
              accent={cfg.accent}
              href={href}
              active={isActive}
            />
          )
        })}
      </div>

      <div className="hidden lg:flex lg:items-center lg:justify-between">
        <p className="text-xs text-muted-foreground" aria-live="polite">{visibleOrders.length} iş emri</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="compact">
              Kolonlar
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {ORDER_LIST_COLUMN_LABELS[column.id as keyof typeof ORDER_LIST_COLUMN_LABELS] ?? column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="hidden lg:block overflow-hidden rounded-lg border border-border bg-card">
        <Table containerClassName="max-h-[70vh]" className="text-sm">
          <TableHeader className="sticky top-0 z-10 bg-card text-xs text-muted-foreground">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const sticky = header.column.id === "actions"
                  return (
                    <TableHead
                      key={header.id}
                      className={
                        sticky
                          ? "sticky right-0 z-20 h-9 border-l border-border bg-card px-3 py-1 text-right"
                          : "h-9 bg-card px-3 py-1"
                      }
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="group hover:bg-muted/60">
                  {row.getVisibleCells().map((cell) => {
                    const sticky = cell.column.id === "actions"
                    return (
                      <TableCell
                        key={cell.id}
                        className={
                          sticky
                            ? "sticky right-0 border-l border-border bg-card h-9 px-3 py-1 align-middle whitespace-nowrap group-hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]"
                            : "h-9 px-3 py-1 align-middle whitespace-nowrap"
                        }
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Bu filtrelere uyan iş emri yok
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="lg:hidden space-y-2.5">
        {visibleOrders.map((order) => (
          <div
            key={order.id}
            className="rounded-lg border border-border bg-card p-3.5 hover:border-border transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/orders/${order.id}`}
                    className="font-mono text-xs font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {order.workOrderNo}
                  </Link>
                  {order.vehicle.id ? (
                    <Link href={`/vehicles/${order.vehicle.id}`}>
                      <PlateBadge plate={order.vehicle.plate} size="sm" />
                    </Link>
                  ) : (
                    <PlateBadge plate={order.vehicle.plate} size="sm" />
                  )}
                </div>
                <Link
                  href={order.customer.id ? `/customers/${order.customer.id}` : "#"}
                  className="mt-1.5 text-sm font-semibold text-foreground truncate block hover:text-primary transition-colors"
                >
                  {customerName(order.customer)}
                </Link>
                <p className="text-xs text-muted-foreground truncate">
                  {order.vehicle.brand} {order.vehicle.model}
                </p>
              </div>
              <MobileActionsMenu
                viewHref={`/orders/${order.id}`}
                editHref={
                  isOrderLocked(order.status as OrderStatus)
                    ? undefined
                    : `/orders/${order.id}?edit=1`
                }
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={order.status} />
              <PaymentText status={order.paymentStatus} />
              {/* Mobil kartta usta hiç görünmüyordu; rozet hem bilgi hem atama tetikleyicisi. */}
              <TechnicianAssign
                orderId={order.id}
                assignedTechnicianId={order.assignedTechnicianId}
                assignedTechnicianName={order.assignedTechnicianName}
                technicians={technicians}
                locked={isOrderLocked(order.status as OrderStatus)}
                size="sm"
              />
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Fatura</span>
              <InvoiceCell invoiceNo={order.invoiceNo} missing={order.invoiceMissing} />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <div className="text-muted-foreground">
                {order.estimatedDeliveryAt ? (
                  <>Tahmini: <span className="text-foreground font-medium">{formatDate(order.estimatedDeliveryAt)}</span></>
                ) : (
                  <span>Giriş: {formatDate(order.createdAt)}</span>
                )}
              </div>
              <div className="font-semibold text-foreground">
                {order.hasPrice ? formatTRY(order.grandTotal) : <span className="text-muted-foreground font-normal">—</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
