import { Check } from "lucide-react"

const benefits = [
  ["İş emirlerini tek yerden yönetin", "Araç kabulünden teslimata kadar akışı takip edin."],
  ["Müşteri geçmişini görün", "Araç, bakım ve onay kayıtlarına hemen erişin."],
  ["Ekibinizle aynı akışta çalışın", "Günlük operasyonunuzu düzenli ve görünür tutun."],
] as const

/** Kayıt ekranının sakin sol sütun yapısını girişe taşır. */
export function LoginSidebar() {
  return (
    <aside className="hidden min-h-full border-r border-border bg-card text-foreground lg:flex lg:w-[340px] lg:shrink-0 lg:flex-col xl:w-[400px]">
      <div className="flex min-h-full flex-1 flex-col px-9 py-12 xl:px-12">
        <div>
          <h2 className="text-4xl font-medium leading-[1.15] tracking-[-0.045em]">
            İşleriniz, kaldığınız yerden devam eder.
          </h2>
          <p className="mt-5 max-w-xs text-sm leading-6 text-muted-foreground">
            BakımX hesabınıza giriş yapın; servis operasyonunuzun tamamına yeniden erişin.
          </p>
        </div>

        <div className="mt-12 border-t border-border pt-7">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            BakımX ile
          </p>
          <ul className="mt-5 space-y-5">
            {benefits.map(([title, description]) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border text-foreground">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  )
}
