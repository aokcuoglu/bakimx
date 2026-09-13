"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Package,
  Wallet,
  Users,
  MonitorSmartphone,
  ClipboardCheck,
  MessageSquareText,
  FileText,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export { ProductStage as ProductTourSection } from "./ProductStage";

export function OperationsSection() {
  return (
    <section
      id="neden"
      className="scroll-mt-24 border-y bg-background py-20 sm:py-28"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              İşin bir de işletme tarafı var
            </p>
            <h2 className="text-3xl font-semibold leading-tight tracking-[-0.04em] text-navy sm:text-4xl">
              İyi servis verin.
              <br />
              Hesabı da bilin.
            </h2>
            <p className="mt-6 max-w-sm text-base leading-7 text-muted-foreground">
              Tezgahtaki iş kadar depodaki parça, yarının randevusu ve ay
              sonundaki hesap da önemli. Hepsini aynı düzenin parçası yapın.
            </p>
            <Button asChild variant="link" className="mt-6 h-auto px-0">
              <Link href="/fiyatlar">
                Servisime uygun paketler <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="grid gap-x-10 sm:grid-cols-2">
            {[
              {
                icon: Package,
                title: "Parça ararken zaman kaybetmeyin.",
                text: "Stok miktarını, kritik seviyeleri ve tedarikçilerinizi takip edin. İş emrinde kullanılan parçalar elinizin altında olsun.",
                tag: "Stok & parçalar",
              },
              {
                icon: Wallet,
                title: "Alacağınız gözden kaçmasın.",
              text: "Tahsilatları, kısmi ödemeleri ve açık bakiyeleri görün. Kasa ve alacak takibiyle günün hesabını kapatın.",
                tag: "Kasa & tahsilat",
              },
              {
                icon: CalendarDays,
                title: "Yarının işini bugünden görün.",
                text: "Randevuları takvimde planlayın. Bakım hatırlatmalarıyla müşterinin bir sonraki ziyaretini takip edin.",
                tag: "Randevu & hatırlatma",
              },
              {
                icon: Users,
                title: "Ekip aynı bilgiyle çalışsın.",
                text: "Yönetici, servis danışmanı ve teknisyen kendi yetkileriyle çalışsın. Görevler ve araç geçmişi aynı yerde bulunsun.",
                tag: "Ekip & müşteri geçmişi",
              },
              {
                icon: FileText,
                title: "e-Fatura & e-Arşiv",
                text: "Servis işlemleri ile elektronik belge süreçlerini birbirine bağlamak için planlanıyor.",
                tag: "Elektronik belgeler",
                upcoming: true,
              },
              {
                icon: Building2,
                title: "Çoklu şube yönetimi",
                text: "Birden fazla şubenin işleyişini ortak bir görünümden takip etmek için planlanıyor.",
                tag: "Şube yönetimi",
                upcoming: true,
              },
            ].map(({ icon: Icon, title, text, tag, upcoming }) => (
              <div key={tag} className="border-t border-border py-7">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <Icon className="size-6 text-primary" />
                  {upcoming && <Badge variant="secondary">Yakında</Badge>}
                </div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {tag}
                </p>
                <h3 className="text-lg font-semibold tracking-tight text-navy">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-8 border-t pt-5 text-xs text-muted-foreground">
          Kasa modülü günlük işletme takibi içindir; resmî muhasebe ve mali
          müşavir hizmetinin yerine geçmez.
        </p>
      </div>
    </section>
  );
}

export function GettingStartedSection() {
  return (
    <section className="bg-background py-20 text-foreground sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-12 grid gap-6 lg:grid-cols-2">
          <h2 className="max-w-xl text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
            Yeni bir düzene geçmek,
            <br />
            işinizi durdurmasın.
          </h2>
          <p className="max-w-md text-base leading-7 lg:justify-self-end">
            Telefon, tablet veya bilgisayarınızdan açın. Kendi servisinizde
            deneyin; sorularınızı birlikte yanıtlayalım.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              icon: MonitorSmartphone,
              n: "01",
              title: "Hesabınızı açın",
              text: "Kart veya paket seçmeden kaydolun. E-posta doğrulamasından sonra 7 iş günlük denemeniz başlasın.",
            },
            {
              icon: ClipboardCheck,
              n: "02",
              title: "İlk aracınızı kaydedin",
              text: "Bir müşteri ve araç ekleyin. Kabulden tahsilata kadar gerçek iş akışınızı deneyin.",
            },
            {
              icon: MessageSquareText,
              n: "03",
              title: "Birlikte değerlendirelim",
              text: "Servisinizin ihtiyaçlarını konuşalım; ekibiniz ve mevcut kayıtlarınız için geçişi planlayalım.",
            },
          ].map(({ icon: Icon, n, title, text }) => (
            <div key={n} className="border-t border-border pt-6">
              <div className="mb-6 flex items-center justify-between">
                <span className="text-xs">{n}</span>
                <Icon className="size-5" />
              </div>
              <h3 className="text-xl font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-7">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
