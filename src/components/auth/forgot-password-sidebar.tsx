import { KeyRound, Mail, ShieldCheck } from "lucide-react"
import {
  AuthFeatureCard,
  ForgotPasswordSidebarVisual,
} from "@/components/auth/auth-sidebar-visuals"

const benefits = [
  {
    icon: Mail,
    title: "E-posta ile güvenli bağlantı",
    description: "Hesabınıza kayıtlı adrese tek kullanımlık sıfırlama bağlantısı gönderilir.",
  },
  {
    icon: KeyRound,
    title: "Bağlantı kısa süre geçerli",
    description: "Sıfırlama bağlantısı 1 saat içinde kullanılmalıdır.",
  },
  {
    icon: ShieldCheck,
    title: "Hesabınız korunur",
    description: "Bağlantı tek kullanımlıktır; işlem sonrası eski oturumlar etkilenmez.",
  },
] as const

/** Giriş/kayıt sol sütun yapısını şifre sıfırlama ekranına taşır. */
export function ForgotPasswordSidebar() {
  return (
    <aside className="no-scrollbar hidden min-h-0 border-r border-border bg-card text-foreground lg:flex lg:w-[340px] lg:shrink-0 lg:flex-col lg:overflow-y-auto xl:w-[400px]">
      <div className="flex flex-1 flex-col px-9 py-10 xl:px-12 xl:py-12">
        <div>
          <h2 className="text-[2rem] font-medium leading-[1.15] tracking-[-0.045em] xl:text-4xl">
            Hesabınıza yeniden erişin.
          </h2>
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
            E-posta adresinizi girin; güvenli bir sıfırlama bağlantısı gönderelim.
          </p>
        </div>

        <div className="mt-7">
          <ForgotPasswordSidebarVisual />
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Nasıl çalışır
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
