"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Boxes,
  CalendarClock,
  Camera,
  Car,
  Clock,
  FileText,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";
import styles from "./mock-app-demo.module.css";

type View = "overview" | "orders" | "new-order";

type CursorTarget =
  | "idle"
  | "nav-orders"
  | "btn-new-order"
  | "btn-create"
  | "nav-overview";

const MOCK_ORDERS = [
  {
    no: "IE-2847",
    plate: "34 ABC 123",
    vehicle: "Ford Transit",
    customer: "Ahmet Yılmaz",
    status: "İşlemde",
    total: "₺6.450",
  },
  {
    no: "IE-2841",
    plate: "34 DEF 456",
    vehicle: "Fiat Egea",
    customer: "Elif Demir",
    status: "Onay bekliyor",
    total: "₺4.200",
  },
  {
    no: "IE-2833",
    plate: "06 LKN 789",
    vehicle: "VW Golf",
    customer: "Mehmet Kaya",
    status: "Teslime hazır",
    total: "₺2.850",
  },
];

const SIDEBAR_ITEMS: {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  target?: "nav-overview" | "nav-orders";
}[] = [
  { id: "overview", label: "Genel Bakış", icon: LayoutDashboard, target: "nav-overview" },
  { id: "appointments", label: "Randevular", icon: CalendarClock },
  { id: "customers", label: "Müşteriler", icon: Users },
  { id: "vehicles", label: "Araçlar", icon: Car },
  { id: "orders", label: "İş Emirleri", icon: Wrench, target: "nav-orders" },
  { id: "quotes", label: "Teklifler", icon: FileText },
  { id: "parts", label: "Stok / Parçalar", icon: Boxes },
  { id: "cash", label: "Kasa", icon: Wallet },
];

const KPIS = [
  {
    label: "Aktif İş Emri",
    value: "12",
    icon: Wrench,
    // accent / bg ayrı satırda — theme-tokens aynı literal'de eşleştirmesin
    accent: "text-primary",
    bg: "bg-primary/10",
  },
  {
    label: "Bugün Teslim",
    value: "4",
    icon: Clock,
    accent: "text-success-strong",
    bg: "bg-success/10",
  },
  {
    label: "Onay Bekleyen",
    value: "2",
    icon: MessageCircle,
    accent: "text-warning-strong",
    bg: "bg-warning/10",
  },
  {
    label: "Eksik Fotoğraf",
    value: "1",
    icon: Camera,
    accent: "text-destructive-strong",
    bg: "bg-destructive/10",
  },
  {
    label: "Bugünkü Randevu",
    value: "8",
    icon: CalendarClock,
    accent: "text-primary",
    bg: "bg-primary/10",
  },
  {
    label: "Kritik Stok",
    value: "3",
    icon: AlertTriangle,
    accent: "text-warning-strong",
    bg: "bg-warning/10",
  },
];

const TOUR: { view: View; cursor: CursorTarget; dwell: number; click?: boolean }[] = [
  { view: "overview", cursor: "idle", dwell: 1800 },
  { view: "overview", cursor: "nav-orders", dwell: 700 },
  { view: "overview", cursor: "nav-orders", dwell: 280, click: true },
  { view: "orders", cursor: "idle", dwell: 1400 },
  { view: "orders", cursor: "btn-new-order", dwell: 700 },
  { view: "orders", cursor: "btn-new-order", dwell: 280, click: true },
  { view: "new-order", cursor: "idle", dwell: 1600 },
  { view: "new-order", cursor: "btn-create", dwell: 650 },
  { view: "new-order", cursor: "btn-create", dwell: 280, click: true },
  { view: "orders", cursor: "idle", dwell: 1100 },
  { view: "orders", cursor: "nav-overview", dwell: 650 },
  { view: "orders", cursor: "nav-overview", dwell: 280, click: true },
];

/**
 * Landing ProductStage için gerçek AppShell /dashboard görünümünün
 * ölçeklenmiş mock’u. Otomatik tur + tıklanabilir gezinme.
 */
export function MockAppDemo() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>("overview");
  const [cursor, setCursor] = useState<CursorTarget>("idle");
  const [clicking, setClicking] = useState(false);
  const [flash, setFlash] = useState<CursorTarget | null>(null);
  const [autoPlay, setAutoPlay] = useState(!prefersReducedMotion);
  const [formFilled, setFormFilled] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const pauseAuto = useCallback(() => {
    clearTimers();
    setAutoPlay(false);
    setClicking(false);
    setFlash(null);
    setCursor("idle");
  }, [clearTimers]);

  const go = useCallback((next: View) => {
    setView(next);
    setFormFilled(next === "new-order");
  }, []);

  const placeCursor = useCallback((target: CursorTarget) => {
    const root = rootRef.current;
    const tip = cursorRef.current;
    if (!root || !tip) return;
    const map: Record<CursorTarget, string | null> = {
      idle: null,
      "nav-orders": '[data-mock-target="nav-orders"]',
      "nav-overview": '[data-mock-target="nav-overview"]',
      "btn-new-order": '[data-mock-target="btn-new-order"]',
      "btn-create": '[data-mock-target="btn-create"]',
    };
    const sel = map[target];
    let x = 240;
    let y = 130;
    if (sel) {
      const el = root.querySelector(sel) as HTMLElement | null;
      if (el) {
        const rootBox = root.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        x = box.left - rootBox.left + box.width * 0.72;
        y = box.top - rootBox.top + box.height * 0.55;
      }
    }
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => placeCursor(cursor));
    return () => cancelAnimationFrame(id);
  }, [cursor, view, placeCursor]);

  useEffect(() => {
    if (!autoPlay || prefersReducedMotion) return;

    clearTimers();
    let step = 0;

    const run = () => {
      const current = TOUR[step];
      setView(current.view);
      setCursor(current.cursor);
      setFormFilled(current.view === "new-order");
      setClicking(false);
      setFlash(null);

      if (current.click) {
        timers.current.push(
          setTimeout(() => {
            setClicking(true);
            setFlash(current.cursor);
            if (current.cursor === "nav-orders") setView("orders");
            if (current.cursor === "btn-new-order") setView("new-order");
            if (current.cursor === "btn-create") setView("orders");
            if (current.cursor === "nav-overview") setView("overview");
          }, Math.max(0, current.dwell - 120)),
        );
      }

      timers.current.push(
        setTimeout(() => {
          step = (step + 1) % TOUR.length;
          run();
        }, current.dwell),
      );
    };

    timers.current.push(setTimeout(run, 0));
    return clearTimers;
  }, [autoPlay, prefersReducedMotion, clearTimers]);

  const activeView = prefersReducedMotion ? "overview" : view;
  const pageTitle =
    activeView === "overview"
      ? "Genel Bakış"
      : activeView === "orders"
        ? "İş Emirleri"
        : "Yeni İş Emri";

  return (
    <div
      ref={rootRef}
      className={styles.shell}
      data-mock-app-demo
      onPointerDownCapture={(e) => {
        if ((e.target as HTMLElement).closest("button, a, input, select")) {
          pauseAuto();
        }
      }}
      onDoubleClick={() => setAutoPlay(true)}
    >
      {/* ── Sidebar (gerçek AppShell navy) ─────────────────────────────── */}
      <aside
        className={cn(
          styles.sidebar,
          "flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
        )}
      >
        <div className={cn(styles.sidebarBrand, "flex items-center gap-2 border-b border-sidebar-border px-3 py-3")}>
          <BrandLogo variant="icon-dark" size="sm" alt="" className="shrink-0" />
          <div className={cn(styles.sidebarCopy, "min-w-0")}>
            <p className="truncate text-[13px] font-bold tracking-tight">
              Bakım<span className="text-sidebar-primary">X</span>
            </p>
            <p className="truncate text-[9px] text-sidebar-foreground/50">Demo Oto Servis</p>
          </div>
        </div>

        <div className={cn(styles.sidebarNavWrap, "flex-1 overflow-y-auto px-2 py-2")}>
          <p
            className={cn(
              styles.sidebarCopy,
              "px-2 pb-1.5 pt-1 text-[9px] font-semibold uppercase tracking-wider text-sidebar-foreground/50",
            )}
          >
            İş Yeri
          </p>
          <nav className="flex flex-col gap-0.5" aria-label="Örnek menü">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const active =
                (item.id === "overview" && activeView === "overview") ||
                (item.id === "orders" &&
                  (activeView === "orders" || activeView === "new-order"));
              const isFlash = item.target && flash === item.target;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-mock-target={item.target}
                  title={item.label}
                  aria-label={item.label}
                  className={cn(
                    styles.sidebarItem,
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isFlash && styles.navFlash,
                  )}
                  onClick={() => {
                    if (item.id === "overview") go("overview");
                    else if (item.id === "orders") go("orders");
                  }}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span className={cn(styles.sidebarCopy, "truncate")}>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div
          className={cn(
            styles.sidebarFooter,
            "mt-auto flex items-center gap-2 border-t border-sidebar-border px-3 py-2.5",
          )}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[10px] font-bold text-sidebar-accent-foreground">
            DK
          </span>
          <div className={cn(styles.sidebarCopy, "min-w-0")}>
            <p className="truncate text-[11px] font-medium">Demo Kullanıcı</p>
            <p className="truncate text-[9px] text-sidebar-foreground/50">Yönetici</p>
          </div>
        </div>
      </aside>

      {/* ── Ana alan ───────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-col bg-muted">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
          <Menu className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="truncate text-sm font-semibold tracking-tight">{pageTitle}</h2>
          <div className="ml-2 hidden min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground sm:flex">
            <Search className="size-3.5 shrink-0" />
            <span className="truncate">Müşteri, plaka veya VIN ara...</span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <span className="flex size-7 items-center justify-center rounded-md text-muted-foreground">
              <Bell className="size-3.5" />
            </span>
            <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground">
              DK
            </span>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3 sm:p-3.5">
          {activeView === "overview" && (
            <>
              <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-navy via-navy to-navy-light p-3.5 text-navy-foreground shadow-sm sm:p-4">
                <div className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-brand/15 blur-2xl" />
                <div className="relative z-10 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-bold tracking-tight sm:text-lg">
                      Hoş Geldiniz, Demo
                    </h3>
                    <p className="mt-0.5 text-[11px] text-navy-foreground/80">
                      Demo Oto Servis · Cumartesi, 12 Eylül
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm"
                    onClick={() => go("new-order")}
                  >
                    <Plus className="size-3.5" />
                    Yeni İş Emri
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
                {KPIS.map((kpi) => {
                  const Icon = kpi.icon;
                  return (
                    <div
                      key={kpi.label}
                      className="rounded-lg border border-border bg-card p-2.5 transition-shadow hover:shadow-sm"
                    >
                      <div className="mb-0.5 flex items-center justify-between gap-1">
                        <span className="text-[9px] font-medium text-muted-foreground">
                          {kpi.label}
                        </span>
                        <span
                          className={cn(
                            "flex size-7 items-center justify-center rounded-lg",
                            kpi.bg,
                          )}
                        >
                          <Icon className={cn("size-3.5", kpi.accent)} />
                        </span>
                      </div>
                      <p className="text-xl font-bold tracking-tight text-foreground">
                        {kpi.value}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-warning-strong">
                <span className="font-semibold">2 iş emri</span> müşteri onayı bekliyor ·{" "}
                <span className="font-semibold">3 parça</span> kritik stok seviyesinde
              </div>

              <OrdersTable />
            </>
          )}

          {activeView === "orders" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] text-muted-foreground">
                  <Search className="size-3.5 shrink-0" />
                  <span className="truncate">Plaka, müşteri veya iş emri ara…</span>
                </div>
                <button
                  type="button"
                  data-mock-target="btn-new-order"
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm",
                    flash === "btn-new-order" && styles.btnFlash,
                  )}
                  onClick={() => go("new-order")}
                >
                  <Plus className="size-3.5" />
                  Yeni İş Emri
                </button>
              </div>
              <OrdersTable />
            </>
          )}

          {activeView === "new-order" && (
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <h3 className="text-sm font-semibold">Yeni iş emri</h3>
                <span className="text-[10px] text-muted-foreground">Demo form</span>
              </div>
              <div className="space-y-2.5 p-3">
                {(
                  [
                    ["Plaka", formFilled ? "34 LKN 123" : "", "34 ABC 123"],
                    ["Müşteri", formFilled ? "Ayşe Yılmaz" : "", "Müşteri seçin"],
                    [
                      "Şikayet / işlem",
                      formFilled ? "Periyodik bakım + hava filtresi" : "",
                      "Kısa açıklama",
                    ],
                  ] as const
                ).map(([label, value, placeholder]) => (
                  <label key={label} className="grid gap-1">
                    <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
                    <input
                      readOnly
                      value={value}
                      placeholder={placeholder}
                      className={cn(
                        "h-8 rounded-md border border-border bg-background px-2.5 text-xs outline-none",
                        formFilled && "border-success/40 bg-success/5",
                      )}
                    />
                  </label>
                ))}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    className="h-8 rounded-md border border-border bg-card px-3 text-xs font-semibold"
                    onClick={() => go("orders")}
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    data-mock-target="btn-create"
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground",
                      flash === "btn-create" && styles.btnFlash,
                    )}
                    onClick={() => go("orders")}
                  >
                    <Wrench className="size-3.5" />
                    İş emri oluştur
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {autoPlay && !prefersReducedMotion && (
        <div
          ref={cursorRef}
          className={cn(styles.cursor, clicking && styles.cursorClick)}
          style={{ left: 240, top: 130 }}
          aria-hidden
        >
          <svg className={styles.cursorSvg} width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M5.5 3.5 19 12.2l-6.1 1.4 2.7 6.6-2.7 1.1-2.8-6.7L5.5 20.5V3.5Z"
              fill="var(--foreground)"
              stroke="var(--card)"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      <div className={styles.badgeLive} aria-hidden>
        <span className={styles.badgeDot} />
        {autoPlay ? "Demo turu" : "İnteraktif · çift tıkla yeniden oynat"}
      </div>
    </div>
  );
}

function OrdersTable() {
  return (
    <div className="max-h-48 overflow-auto rounded-lg border border-border bg-card">
      <table className="w-full text-left text-[11px]">
        <caption className="sr-only">Aktif iş emirleri</caption>
        <thead>
          <tr className="border-b border-border bg-muted/80">
            <th className="px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              İş No
            </th>
            <th className="px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Plaka / Araç
            </th>
            <th className="px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Müşteri
            </th>
            <th className="px-2.5 py-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Durum
            </th>
            <th className="px-2.5 py-2 text-right text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Toplam
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {MOCK_ORDERS.map((row) => (
            <tr key={row.no} className="hover:bg-muted/60">
              <td className="px-2.5 py-2 font-mono text-[10px] font-semibold">{row.no}</td>
              <td className="px-2.5 py-2">
                <div className="font-semibold">{row.plate}</div>
                <div className="text-[10px] text-muted-foreground">{row.vehicle}</div>
              </td>
              <td className="px-2.5 py-2 text-muted-foreground">{row.customer}</td>
              <td className="px-2.5 py-2">
                <span className="inline-flex rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary-strong">
                  {row.status}
                </span>
              </td>
              <td className="px-2.5 py-2 text-right font-semibold">{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
