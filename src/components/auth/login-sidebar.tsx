import { ClipboardList, History, Users } from "lucide-react"
import {
  AuthFeatureCard,
  LoginSidebarVisual,
} from "@/components/auth/auth-sidebar-visuals"

const benefits = [
  {
    icon: ClipboardList,
    title: "İş emirlerini tek yerden yönetin",
    description: "Araç kabulünden teslimata kadar akışı takip edin.",
  },
  {
    icon: History,
    title: "Müşteri geçmişini görün",
    description: "Araç, bakım ve onay kayıtlarına hemen erişin.",
  },
  {
    icon: Users,
    title: "Ekibinizle aynı akışta çalışın",
    description: "Günlük operasyonunuzu düzenli ve görünür tutun.",
  },
] as const

/** Kayıt ekranının sakin sol sütun yapısını girişe taşır; mini ürün UI ile görselleştirir. */
export function LoginSidebar() {
  return (
    <aside className="no-scrollbar hidden min-h-0 border-r border-border bg-card text-foreground lg:flex lg:w-[340px] lg:shrink-0 lg:flex-col lg:overflow-y-auto xl:w-[400px]">
      <div className="flex flex-1 flex-col px-9 py-10 xl:px-12 xl:py-12">
        <div>
          <h2 className="text-[2rem] font-medium leading-[1.15] tracking-[-0.045em] xl:text-4xl">
            İşleriniz, kaldığınız yerden devam eder.
          </h2>
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
            BakımX hesabınıza giriş yapın; servis operasyonunuzun tamamına yeniden erişin.
          </p>
        </div>

        <div className="mt-7">
          <LoginSidebarVisual />
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            BakımX ile
          </p>
          <ul className="mt-3 space-y-2">
            {benefits.map((item) => (
              <AuthFeatureCard
                key={item.title}
                icon={item.icon}
                title={item.title}
                description={item.description}
              />
            ))}
          </ul>
        </div>
      </div>
    </aside>
  )
}
