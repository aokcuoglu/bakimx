"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardList,
  LayoutDashboard,
  CalendarDays,
  Users,
  Package,
  Wallet,
  CarFront,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackMarketingEvent } from "@/lib/marketing-analytics";

const vehicles = [
  {
    plate: "34 ABC 123",
    car: "Volkswagen Golf",
    task: "Periyodik bakım",
    status: "İşlemde",
    color: "bg-primary/10 text-primary-strong",
  },
  {
    plate: "06 DEF 456",
    car: "Renault Clio",
    task: "Fren kontrolü",
    status: "Onay bekliyor",
    color: "bg-warning/10 text-warning-strong",
  },
  {
    plate: "35 GHK 789",
    car: "Fiat Egea",
    task: "Yağ ve filtre değişimi",
    status: "Teslime hazır",
    color: "bg-success/10 text-success-strong",
  },
];

export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-title"
      className="overflow-hidden border-b border-border bg-background"
    >
      <div className="mx-auto max-w-7xl px-5 pb-12 pt-14 sm:px-8 sm:pb-16 sm:pt-20 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.15fr] lg:gap-12">
          <div>
            <p className="mb-6 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Oto
              servisler için yönetim programı
            </p>
            <h1
              id="hero-title"
              className="max-w-xl text-[2.8rem] font-semibold leading-[1.08] tracking-[-0.055em] text-navy sm:text-6xl lg:text-[4rem]"
            >
              Serviste işler
              <br />
              yolunda.
              <br />
              <span className="text-primary">Kontrol sizde.</span>
            </h1>
            <p className="mt-7 max-w-md text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Hangi araç ne bekliyor, hangi iş tamamlandı, kim ne kadar
              ödeyecek? İş emirlerini, müşterilerinizi ve kasanızı tek yerden
              takip edin.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="xl" className="h-12 px-5">
                <Link
                  href="/register"
                  onClick={() =>
                    trackMarketingEvent("trial_cta_click", {
                      cta_location: "hero_primary",
                    })
                  }
                >
                  Ücretsiz denemeye başlayın <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="xl" className="h-12 px-5">
                <a
                  href="#demo-form"
                  onClick={() =>
                    trackMarketingEvent("demo_cta_click", {
                      cta_location: "hero_secondary",
                      destination: "form",
                    })
                  }
                >
                  Birlikte inceleyelim
                </a>
              </Button>
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5" />7 iş günü ücretsiz
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5" />
                Kredi kartı gerekmez
              </span>
            </p>
          </div>
          <div className="relative min-w-0 lg:-mr-24 xl:-mr-32">
            <div className="rounded-2xl border border-border bg-muted p-2.5 shadow-xl shadow-navy/5 sm:p-3.5">
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <span className="flex items-center gap-2 text-xs font-semibold text-navy">
                    <span className="size-2 rounded-full bg-primary" /> BakımX ·
                    Servis paneli
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Örnek servis verileri
                  </span>
                </div>
                <div className="flex min-h-[390px] sm:min-h-[450px]">
                  <aside
                    aria-hidden="true"
                    className="hidden w-36 shrink-0 border-r bg-navy px-3 py-5 text-navy-foreground sm:block"
                  >
                    <p className="mb-7 px-2 text-xs font-medium">
                      Merkez Oto Servis
                    </p>
                    {[
                      { icon: LayoutDashboard, label: "Genel bakış" },
                      { icon: ClipboardList, label: "İş emirleri" },
                      { icon: Users, label: "Müşteriler" },
                      { icon: CalendarDays, label: "Randevular" },
                      { icon: Package, label: "Stok / Parçalar" },
                      { icon: Wallet, label: "Kasa" },
                    ].map(({ icon: Icon, label }, i) => (
                      <div
                        key={label}
                        className={`mb-2 flex items-center gap-2 rounded-md px-2 py-2.5 text-[11px] ${i === 1 ? "bg-navy-foreground/15" : ""}`}
                      >
                        <Icon className="size-3.5" />
                        {label}
                      </div>
                    ))}
                  </aside>
                  <div className="min-w-0 flex-1 bg-background p-4 sm:p-5">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-muted-foreground">
                          SERVİSİNİZDE BUGÜN
                        </p>
                        <p className="mt-1 text-lg font-semibold tracking-tight text-navy">
                          Her iş gözünüzün önünde.
                        </p>
                      </div>
                      <CalendarDays className="size-5 text-muted-foreground" />
                    </div>
                    <div className="mb-5 grid grid-cols-3 gap-2">
                      {[
                        { label: "Aktif iş emri", value: "12" },
                        { label: "Onay bekleyen", value: "3" },
                        { label: "Teslime hazır", value: "4" },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-lg border bg-card p-3"
                        >
                          <p className="text-[10px] text-muted-foreground">
                            {item.label}
                          </p>
                          <p className="mt-2 text-2xl font-semibold tracking-tight text-navy">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="overflow-hidden rounded-lg border bg-card">
                      <div className="flex justify-between border-b px-3 py-3 text-xs">
                        <span className="font-semibold">Günün iş emirleri</span>
                        <span className="text-muted-foreground">3 araç</span>
                      </div>
                      {vehicles.map((vehicle) => (
                        <div
                          key={vehicle.plate}
                          className="flex items-center justify-between gap-2 border-b px-3 py-4 last:border-0"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="hidden rounded-md bg-muted p-2 sm:block">
                              <CarFront className="size-4 text-navy" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-navy">
                                {vehicle.plate}
                                <span className="ml-2 hidden text-[10px] font-normal text-muted-foreground xl:inline">
                                  {vehicle.car}
                                </span>
                              </p>
                              <p className="mt-1 text-[10px] text-muted-foreground">
                                {vehicle.task}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-medium ${vehicle.color}`}
                          >
                            {vehicle.status}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Check className="size-3.5 text-success-strong" /> Araç
                      kabulünden teslimata, aynı kayıt üzerinden.
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative ml-8 -mt-5 flex max-w-xs items-center gap-3 rounded-xl border bg-card p-4 shadow-lg shadow-navy/5 sm:ml-20">
              <div className="rounded-full bg-success/10 p-2 text-success-strong">
                <Check className="size-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-navy">
                  Müşteri onayı alındı
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  06 DEF 456 · Fren kontrolü · Örnek
                </p>
              </div>
              <ChevronRight className="ml-auto size-4 text-muted-foreground" />
            </div>
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-4 border-t pt-7 sm:flex-row sm:items-center sm:justify-between lg:mt-20">
          <p className="text-xs text-muted-foreground">
            Küçük bir atölyeden büyüyen servis ekiplerine.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-navy">
            <span>Özel servisler</span>
            <span>Bakım & onarım</span>
            <span>Lastik & hızlı servis</span>
            <span>Kaporta & boya</span>
          </div>
        </div>
      </div>
    </section>
  );
}
