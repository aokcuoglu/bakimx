"use client"

import { useMemo, type MouseEvent, type ReactNode } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { orderDetailHref, readOrderListState, type OrderListState } from "@/lib/orders/list-state"
import type { Updater } from "@tanstack/react-table"
import { CarFront, ChevronDown, CircleCheck, CircleX, FileWarning, MessageCircle, Wrench } from "lucide-react"
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

import { DashOrderStatus, DashPlate, DashStat, DashStatGrid, type Tone } from "@/components/dashboard/surface"
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
import { TechnicianAssign, type AssignableTechnician } from "@/components/orders/technician-assign"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatTRY } from "@/lib/format"
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants"
import { matchesColumnFilter, ORDER_LIST_COLUMN_LABELS, ORDER_LIST_DATA_COLUMN_ORDER } from "@/lib/orders/list-columns"
import { isOrderLocked } from "@/lib/status-transitions"
import type { OrderStatus } from "@prisma/client"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { useOrderListNavigation } from "@/components/orders/use-order-list-navigation"
import { ACTIVE_ORDER_FILTER } from "@/lib/orders/status-filter"
import type { OrderListRow } from "@/lib/orders/list-query"

type OrderRow = OrderListRow

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
  icon: React.ComponentType
  /** Kartın kimlik rengi (Genel Bakış KPI kartlarıyla aynı kalıp). */
  accent: Tone
  /** Değer > 0 iken rakamı uyarı tonuna boyar. */
  tone?: "warning"
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

/**
 * Detay bağlantılarının geri dönüş adresi tablo `meta`sından okunur, kolon
 * tanımlarına kapatılmaz: liste adresi (`view`) her filtre tuşunda değişir;
 * kolonlar ona bağlı olsaydı her harfte yeniden kurulur, başlıktaki filtre
 * paneli de söküldüğü için ilk harften sonra kapanırdı.
 */
function listHrefOf(table: { options: { meta?: unknown } }): string {
  return (table.options.meta as { listHref?: string } | undefined)?.listHref ?? "/orders"
}

/**
 * Satır tıklaması bu öğelerin içinden gelirse gezinmez: iş no bağlantısı
 * kendi (yerel) davranışını yapar, teknisyen ataması ve ⋯ menüsü kendi işini.
 */
const ROW_OWN_CONTROLS = "a[href], button, input, select, textarea, [role='button'], [role='combobox'], [role='menuitem']"

/**
 * Masaüstü tablosunda satırın tamamı iş emrine gider. Erişilebilir hedef
 * iş no bağlantısıdır (klavye, ekran okuyucu); satır tıklaması onun fare
 * kısayoludur. Cmd/Ctrl/orta tık yeni sekme açar, sürükleyerek metin seçmek
 * gezinmez.
 */
function openRowTarget(event: MouseEvent<HTMLTableRowElement>, href: string, push: (href: string) => void) {
  if (event.defaultPrevented) return
  const target = event.target as Element
  // Portallanan içerik (teknisyen paneli, ⋯ menüsü) React ağacında satırın
  // altındadır ama DOM'da değildir; oradaki tıklamalar satıra ait değil.
  if (!event.currentTarget.contains(target) || target.closest(ROW_OWN_CONTROLS)) return
  if (window.getSelection()?.toString()) return
  if (event.button === 1 || (event.button === 0 && (event.metaKey || event.ctrlKey))) {
    window.open(href, "_blank", "noopener")
    return
  }
  if (event.button !== 0 || event.shiftKey || event.altKey) return
  push(href)
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
  activeDelivery = "",
  technicians = [],
  searchQuery = "",
  totalCount,
  nextLimit,
  maxRows,
  toolbar,
  emptyState,
}: {
  orders: OrderRow[]
  kpis: KPIs
  activeStatus: string
  activePayment: string
  activeTechnician?: string
  activeInvoice?: string
  activeDelivery?: string
  technicians?: AssignableTechnician[]
  searchQuery?: string
  /** Filtrelere uyan toplam kayıt (yüklenen `orders` bunun en yeni dilimi olabilir). */
  totalCount: number
  /** Bir sonraki `?limit=` değeri; yüklenecek kayıt yok ya da tavandaysa null. */
  nextLimit: number | null
  maxRows: number
  toolbar?: ReactNode
  emptyState?: ReactNode
}) {
  const { rootRef, isPending, isLoadingMore, loadMore, onChange, onSubmit, onClick } = useOrderListNavigation(searchQuery)
  const router = useRouter()
  const kpiConfigs: KpiConfig[] = [
    { key: "active", label: "Aktif", count: kpis.active, filterValue: ACTIVE_ORDER_FILTER, icon: Wrench, accent: "info" },
    { key: "waitingApproval", label: "Onay Bekliyor", count: kpis.waitingApproval, filterValue: "waiting_approval", icon: MessageCircle, accent: "warning", tone: "warning" },
    // Kart `ready_for_delivery`'yi filtreler; adı durumun kendi adıyla aynı (eskiden "Tamamlandı").
    { key: "completed", label: "Teslime Hazır", count: kpis.completed, filterValue: "ready_for_delivery", icon: CircleCheck, accent: "success" },
    { key: "delivered", label: "Teslim Edildi", count: kpis.delivered, filterValue: "delivered", icon: CarFront, accent: "neutral" },
    { key: "cancelled", label: "İptal", count: kpis.cancelled, filterValue: "cancelled", icon: CircleX, accent: "destructive" },
  ]

  // KPI kartına tıklamak yalnız durumu değiştirmeli; diğer aktif filtreler korunur.
  const keptFilters = [
    searchQuery ? `q=${encodeURIComponent(searchQuery)}` : "",
    activePayment ? `payment=${activePayment}` : "",
    activeTechnician ? `technician=${encodeURIComponent(activeTechnician)}` : "",
    activeInvoice ? `invoice=${encodeURIComponent(activeInvoice)}` : "",
    activeDelivery ? `delivery=${encodeURIComponent(activeDelivery)}` : "",
  ].filter(Boolean)

  const searchParams = useSearchParams()
  const view = searchParams.get("view")
  const { sorting, columnFilters, columnVisibility } = useMemo(() => readOrderListState(view), [view])
  const listHref = `/orders${searchParams.size ? `?${searchParams}` : ""}`
  if (view) keptFilters.push(`view=${encodeURIComponent(view)}`)

  function updateView<K extends keyof OrderListState>(key: K, updater: Updater<OrderListState[K]>) {
    // Read the current URL so rapid successive changes preserve each other.
    const params = new URLSearchParams(window.location.search)
    const current = readOrderListState(params.get("view"))
    current[key] = typeof updater === "function" ? updater(current[key]) : updater
    params.set("view", JSON.stringify(current))
    window.history.replaceState(null, "", `/orders?${params}`)
  }

  const columns = useMemo<ColumnDef<OrderRow>[]>(() => {
    const byId: Record<(typeof ORDER_LIST_DATA_COLUMN_ORDER)[number], ColumnDef<OrderRow>> = {
      workOrderNo: {
        id: "workOrderNo",
        accessorFn: (order) => order.workOrderNo,
        header: ({ column }) => <OrderTableColumnHeader column={column} title="İş No" />,
        filterFn: textFilter((order) => order.workOrderNo),
        cell: ({ row, table }) => (
          <Link
            href={orderDetailHref(row.original.id, listHrefOf(table))}
            className="rounded-xs font-mono text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              <DashPlate plate={order.vehicle.plate} country size="sm" />
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
              <span className="block max-w-[9.5rem] truncate text-[15px] font-semibold text-foreground">{name}</span>
            </DetailHint>
          )
        },
      },
      status: {
        id: "status",
        accessorFn: statusSearch,
        header: ({ column }) => <OrderTableColumnHeader column={column} title="Durum" />,
        filterFn: textFilter(statusSearch),
        cell: ({ row }) => <DashOrderStatus status={row.original.status} />,
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
        header: ({ column }) => <OrderTableColumnHeader column={column} title="Toplam" align="right" kind="number" />,
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
        header: ({ column }) => <OrderTableColumnHeader column={column} title="Giriş tarihi" kind="date" />,
        filterFn: textFilter((order) => formatDate(order.createdAt)),
        cell: ({ row }) => <span className="whitespace-nowrap text-[13px] tabular-nums text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
      },
      delivery: {
        id: "delivery",
        accessorFn: (order) => order.estimatedDeliveryAt,
        sortUndefined: "last",
        header: ({ column }) => <OrderTableColumnHeader column={column} title="Tahmini teslim" kind="date" />,
        filterFn: textFilter((order) => order.estimatedDeliveryAt ? formatDate(order.estimatedDeliveryAt) : ""),
        cell: ({ row }) => <span className="whitespace-nowrap text-[13px] tabular-nums text-muted-foreground">{row.original.estimatedDeliveryAt ? formatDate(row.original.estimatedDeliveryAt) : "—"}</span>,
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
            className="max-w-[7rem] px-0"
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
        cell: ({ row, table }) => (
          <div className="flex items-center justify-end">
            <ActionsMenu
              viewHref={orderDetailHref(row.original.id, listHrefOf(table))}
              editHref={
                isOrderLocked(row.original.status as OrderStatus)
                  ? undefined
                  : orderDetailHref(row.original.id, listHrefOf(table), true)
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
    onSortingChange: (updater: Updater<SortingState>) => updateView("sorting", updater),
    onColumnFiltersChange: (updater: Updater<ColumnFiltersState>) => updateView("columnFilters", updater),
    onColumnVisibilityChange: (updater: Updater<VisibilityState>) => updateView("columnVisibility", updater),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (order) => order.id,
    meta: { listHref },
  })

  const visibleOrders = table.getRowModel().rows.map((row) => row.original)
  const isTruncated = totalCount > orders.length
  const hasLocalView = sorting.length > 0 || columnFilters.length > 0
  const footer =
    nextLimit !== null ? (
      <Button
        type="button"
        variant="outline"
        className="w-full rounded-full aria-disabled:pointer-events-none aria-disabled:text-muted-foreground sm:w-auto"
        aria-disabled={isLoadingMore}
        aria-busy={isLoadingMore}
        onClick={() => {
          if (isLoadingMore) return
          loadMore(nextLimit)
        }}
      >
        {isLoadingMore ? "Yükleniyor…" : "Daha fazla yükle"}
      </Button>
    ) : isTruncated ? (
      <p className="text-sm text-muted-foreground">
        En yeni {maxRows} kayıt gösteriliyor. Daha eskileri için arama veya filtre kullanın.
      </p>
    ) : null

  return (
    <div ref={rootRef} className="space-y-5 sm:space-y-6" onChange={onChange} onSubmit={onSubmit} onClickCapture={onClick}>
      {/* Durum kartları — Genel Bakış KPI kartlarıyla aynı kalıp; her kart bir
          durum filtresidir, seçili olan mavi çerçeveyle işaretlenir. */}
      <DashStatGrid label="Araç kabul durum özeti" count={kpiConfigs.length} size="compact">
        {kpiConfigs.map(({ icon: Icon, ...cfg }) => {
          const isActive = activeStatus === cfg.filterValue
          const parts = isActive ? keptFilters : [`status=${cfg.filterValue}`, ...keptFilters]
          const href = parts.length > 0 ? `/orders?${parts.join("&")}` : "/orders"
          return (
            <DashStat
              key={cfg.key}
              label={cfg.label}
              value={cfg.count}
              href={href}
              icon={<Icon />}
              accent={cfg.accent}
              tone={cfg.count > 0 ? cfg.tone : undefined}
              active={isActive}
              size="compact"
            />
          )
        })}
      </DashStatGrid>

      {toolbar && (
        <div className="rounded-[22px] bg-card p-4 sm:p-5">
          {view && <input type="hidden" name="view" value={view} form="order-list-filters" />}
          {toolbar}
        </div>
      )}

      <div className="relative overflow-hidden rounded-[22px] bg-card" aria-label="Araç kabul sonuçları" aria-busy={isPending}>
        {isPending && (
          <div className="absolute inset-0 z-30 flex min-h-32 items-start justify-center bg-card/90">
            <BrandSpinner size={32} label="Araç kabulleri yükleniyor…" className="sticky top-0 py-8" />
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-foreground" aria-live="polite">
              {visibleOrders.length}
              {isTruncated && <span className="font-normal text-muted-foreground"> / {totalCount.toLocaleString("tr-TR")}</span>}{" "}
              <span className="font-normal text-muted-foreground">araç kabulü</span>
            </p>
            {isTruncated && hasLocalView && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Sıralama ve kolon araması yalnız yüklenen {orders.length} kayıtta geçerli.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {view && (
              <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => {
                const params = new URLSearchParams(window.location.search)
                params.delete("view")
                window.history.replaceState(null, "", `/orders${params.size ? `?${params}` : ""}`)
              }}>
                Görünümü sıfırla
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="hidden rounded-full lg:inline-flex">
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
        </div>

        {orders.length === 0 && emptyState}
        {orders.length > 0 && <div className="hidden lg:block">
          <Table containerClassName="max-h-[70vh]" className="text-sm">
            <TableHeader className="sticky top-0 z-10 bg-card text-[13px] text-muted-foreground">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    const sticky = header.column.id === "actions"
                    return (
                      <TableHead
                        key={header.id}
                        className={
                          sticky
                            ? "sticky right-0 z-20 h-11 bg-card px-2.5 py-1 pr-3 text-right"
                            : "h-11 bg-card px-2.5 py-1 first:pl-4"
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
                table.getRowModel().rows.map((row) => {
                  const detailHref = orderDetailHref(row.original.id, listHref)
                  return (
                    <TableRow
                      key={row.id}
                      className="group cursor-pointer hover:bg-muted/60"
                      onClick={(event) => openRowTarget(event, detailHref, (href) => router.push(href))}
                      onAuxClick={(event) => openRowTarget(event, detailHref, (href) => router.push(href))}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const sticky = cell.column.id === "actions"
                        return (
                          <TableCell
                            key={cell.id}
                            className={
                              sticky
                                ? "sticky right-0 h-14 bg-card px-2.5 py-2 pr-3 align-middle whitespace-nowrap group-hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]"
                                : "h-14 px-2.5 py-2 align-middle whitespace-nowrap first:pl-4"
                            }
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    {isTruncated
                      ? "Yüklenen kayıtlarda eşleşme yok — tüm kayıtlarda aramak için üstteki aramayı kullanın"
                      : "Bu filtrelere uyan araç kabulü yok"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>}

        {/* Telefon/tablet: Genel Bakış satır kalıbı — tek kartta çizgiyle ayrılan
            satırlar. Satırın tamamı (plaka dahil) detaya gider (gerilmiş
            bağlantı); usta ataması ve ⋯ menüsü onun üstünde kendi işini yapar. */}
        {orders.length > 0 && <ul className="divide-y divide-border lg:hidden">
          {visibleOrders.map((order) => {
            const detailHref = orderDetailHref(order.id, listHref)
            const vehicleText = [order.vehicle.brand, order.vehicle.model].filter(Boolean).join(" ")
            const dateText = order.estimatedDeliveryAt
              ? `Teslim ${formatDate(order.estimatedDeliveryAt)}`
              : `Giriş ${formatDate(order.createdAt)}`
            const showInvoice = Boolean((order.invoiceNo || "").trim()) || order.invoiceMissing
            return (
              <li key={order.id} className="relative px-4 py-3.5 transition-colors hover:bg-muted/60">
                <div className="flex items-center gap-2">
                  <DashPlate plate={order.vehicle.plate} country size="lg" />
                  <span className="ml-auto"><DashOrderStatus status={order.status} /></span>
                  <span className="relative z-10">
                    <MobileActionsMenu
                      viewHref={detailHref}
                      editHref={
                        isOrderLocked(order.status as OrderStatus)
                          ? undefined
                          : orderDetailHref(order.id, listHref, true)
                      }
                    />
                  </span>
                </div>
                <Link href={detailHref} className="mt-2 block min-w-0 outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-ring">
                  <span className="block truncate text-[17px] font-semibold leading-[22px] text-foreground">{customerName(order.customer)}</span>
                  <span className="mt-0.5 block truncate text-[15px] leading-5 text-muted-foreground">
                    {[vehicleText, dateText].filter(Boolean).join(" · ")}
                  </span>
                </Link>
                <div className="pointer-events-none relative z-10 mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 [&>*]:pointer-events-auto">
                  <TechnicianAssign
                    orderId={order.id}
                    assignedTechnicianId={order.assignedTechnicianId}
                    assignedTechnicianName={order.assignedTechnicianName}
                    technicians={technicians}
                    locked={isOrderLocked(order.status as OrderStatus)}
                    size="sm"
                  />
                  <PaymentText status={order.paymentStatus} />
                  {showInvoice && <InvoiceCell invoiceNo={order.invoiceNo} missing={order.invoiceMissing} />}
                  <span className="ml-auto text-[15px] font-semibold tabular-nums text-foreground">
                    {order.hasPrice ? formatTRY(order.grandTotal) : <span className="font-normal text-muted-foreground">—</span>}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>}
        {orders.length > 0 && footer && <div className="border-t border-border px-4 py-3 sm:px-5">{footer}</div>}
      </div>
    </div>
  )
}
