import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const source = readFileSync(join(import.meta.dir, "technician-dashboard.tsx"), "utf8")

describe("teknisyen paneli KPI filtreleri", () => {
  test("dört KPI kartını klavye erişilebilir seçim kontrolü olarak sunar", () => {
    expect(source).toContain('type="button"')
    expect(source).toContain('aria-pressed={activeFilter === card.filter}')
    expect(source).toContain('onClick={() => handleFilterChange(card.filter)}')
  })

  test("filtreyi URL'de tutar ve teknisyen seçimini değiştirdiğinde korur", () => {
    expect(source).toContain('const DASHBOARD_FILTER_PARAM = "filter"')
    expect(source).toContain('new URLSearchParams(searchParams.toString())')
    expect(source).toContain('params.set(TECHNICIAN_PARAM, value)')
  })

  test("seçilen KPI için tek ilgili listeyi ve boş durumu gösterir", () => {
    expect(source).toContain('const visibleSections = activeFilter === "all"')
    expect(source).toContain('Bugün teslim edilecek iş bulunmuyor')
    expect(source).toContain('{visibleSections.map((section) => {')
  })

  test("\"Bana Atanan\" kart değil anahtardır; varsayılan kapsam atölyenin tamamıdır", () => {
    expect(source).not.toContain('filter: "assigned"')
    expect(source).not.toContain('Bana Atanan İşler')
    expect(source).toContain('const ONLY_MINE_PARAM = "mine"')
    expect(source).toContain('Bana atananlar')
    expect(source).toContain('onCheckedChange={handleOnlyMineChange}')
  })

  test("varsayılan listeler KPI kartlarıyla aynı durum tanımını kullanır", () => {
    expect(source).toContain('const activeOrders = orders.filter((o) => o.status === "in_progress")')
    expect(source).toContain('const waitingOrders = orders.filter((o) => ["approved", "waiting_parts"].includes(o.status))')
    expect(source).toContain('const draftOrders = orders.filter((o) => ["draft", "waiting_approval"].includes(o.status))')
  })

  test("Taslak İşler varsayılan olarak kapalı gelir ve kartların altı çizilmez", () => {
    expect(source).toContain('title: "Taslak İşler", orders: draftOrders, empty: "Taslak iş bulunmuyor", collapsible: true')
    // `disclosure` görünümü içerikteki bağlantıların altını çizmez (#926);
    // çağrı yerinde `[&_a]:no-underline` ile kapatmaya gerek kalmadı.
    expect(source).toContain('<Accordion key={section.title} type="single" collapsible variant="disclosure">')
    expect(source).not.toMatch(/<Accordion[^>]*defaultValue/)
    expect(source).not.toContain("[&_a]:" + "no-underline")
  })

  test("iş listelerinde adet, tıklanabilirlik ve aktif iş vurgusu gösterir", () => {
    expect(source).toContain('const count = section.total !== undefined ? section.total : section.orders.length')
    expect(source).toContain('({count})')
    // KPI kartı doğal yüksekliğini `size="row"`dan alır (#889; eski `h-auto`);
    // seçili kartın tonu `tint` variant'ından gelir, className'den değil (#925).
    expect(source).toContain('variant={activeFilter === card.filter ? "tint" : "outline"}\n                  size="row"')
    expect(source).not.toContain('"bg-primary/10 ring-2 ring-primary')
    expect(source).toContain('"min-w-0 cursor-pointer items-start')
    expect(source).toContain('cursor-pointer bg-card/80 shadow-xs transition-all hover:bg-muted/60 hover:bg-primary/10 hover:ring-2 hover:ring-primary/20')
  })

  test("son tamamlananları iki günlük veriyle onarlı sayfalara böler", () => {
    expect(source).toContain('useDashboardPage(recentCompletedOrders, 10)')
    expect(source).toContain('title: "Son Tamamlananlar"')
  })

  test("iş kartı yalnız durum, plaka, araç ve müşteriyi gösterir", () => {
    expect(source).toContain('<Plate plate={order.plate} size="lg" />')
    expect(source).toContain('<ItemDescription className="flex items-center gap-2">')
    expect(source).not.toContain('order.workOrderNo}')
    expect(source).not.toContain('Kontrol listesi')
    expect(source).not.toContain('Tamamlandı: {formatDate(order.completedAt)}')
  })
})
