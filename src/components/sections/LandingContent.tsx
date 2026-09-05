"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CalendarDays,
  Package,
  Wallet,
  Users,
  MonitorSmartphone,
  ClipboardCheck,
  MessageSquareText,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

const tour = [
  {
    id: "order",
    label: "İş emri",
    number: "01",
    title: "Bir araç. Tek kayıt. Baştan sona.",
    description:
      "Müşterinin şikâyeti, yapılacak işler, kullanılan parçalar ve tahsilat aynı iş emrinde. Ustanız da siz de işin hangi aşamada olduğunu görün.",
    points: [
      "Parça ve işçilik kalemlerini birlikte hazırlayın",
      "İşi teknisyene atayın, durumunu takip edin",
      "Ödenen tutarı ve kalan bakiyeyi görün",
    ],
    image: "/landing/screens/order-detail.png",
    width: 1440,
    height: 900,
    alt: "BakımX iş emri ekranında müşteri, araç, iş durumu ve tahsilat bilgileri",
  },
  {
    id: "intake",
    label: "Araç kabul",
    number: "02",
    title: "Araç gelirken her şey kayıt altında.",
    description:
      "Kilometreyi, yakıt seviyesini, mevcut hasarları ve müşteri talebini kaydedin. Kabul fotoğraflarıyla aracın teslim alındığı durumu belgeleyin.",
    points: [
      "Hasarı araç şeması üzerinde işaretleyin",
      "Kabul fotoğraflarını iş emrine ekleyin",
      "Ruhsattan okunan bilgileri kontrol ederek onaylayın",
    ],
    image: "/landing/screens/digital-intake-damage-map.png",
    width: 1000,
    height: 1400,
    alt: "Dijital araç kabul ekranında araç şeması üzerinde kaydedilmiş hasar",
  },
  {
    id: "tracking",
    label: "Müşteri takibi",
    number: "03",
    title: "Müşteriniz de ne yapıldığını bilsin.",
    description:
      "Araç kabul ve işlem özetini bir bağlantıyla paylaşın. Müşteriniz telefonundan yapılan işlemleri görsün; siz servisinizdeki işe odaklanın.",
    points: [
      "Araç kabul ve işlem özetini paylaşın",
      "Teklif ve müşteri onaylarını takip edin",
      "Müşteriniz linki telefonundan açsın",
    ],
    image: "/landing/screens/public-tracking.png",
    width: 390,
    height: 844,
    alt: "Müşterinin telefonunda açılan BakımX araç kabul ve işlem özeti",
  },
];

export function ProductTourSection() {
  return (
    <section id="ozellikler" className="scroll-mt-24 bg-card py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Servisinizin günlük akışı
            </p>
            <h2 className="max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.04em] text-navy sm:text-4xl lg:text-5xl">
              Araç kabulünden anahtar teslimine.
            </h2>
          </div>
          <p className="max-w-xs text-sm leading-6 text-muted-foreground">
            BakımX&apos;in gerçek ekranlarına göz atın. Her adım, servisteki bir
            işi kolaylaştırmak için.
          </p>
        </div>
        <Tabs defaultValue="order" className="gap-7">
          <TabsList
            aria-label="Ürün özellikleri"
            className="h-auto! grid w-full grid-cols-3 gap-1 rounded-none border-b bg-transparent p-0 pb-3 sm:flex sm:w-fit sm:gap-2"
          >
            <>
              {tour.map((item) => (
                <TabsTrigger
                  key={item.id}
                  value={item.id}
                  className="h-11 min-w-0 gap-1 rounded-lg px-1 text-xs text-muted-foreground data-[state=active]:bg-navy data-[state=active]:text-navy-foreground sm:flex-none sm:gap-2 sm:px-4 sm:text-sm"
                >
                  <span
                    aria-hidden="true"
                    className="hidden text-[10px] sm:inline"
                  >
                    {item.number}
                  </span>
                  {item.label}
                </TabsTrigger>
              ))}
            </>
          </TabsList>
          {tour.map((item) => (
            <TabsContent key={item.id} value={item.id}>
              <div className="grid overflow-hidden rounded-2xl border bg-background lg:min-h-[490px] lg:grid-cols-[0.75fr_1.25fr]">
                <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
                  <span className="mb-7 text-sm font-medium text-muted-foreground">
                    /{item.number}
                  </span>
                  <h3 className="text-2xl font-semibold leading-tight tracking-tight text-navy sm:text-3xl">
                    {item.title}
                  </h3>
                  <p className="mt-5 text-sm leading-7 text-muted-foreground">
                    {item.description}
                  </p>
                  <ul className="mt-7 space-y-3">
                    {item.points.map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-2.5 text-sm leading-6 text-navy"
                      >
                        <Check className="mt-1 size-4 shrink-0 text-primary" />
                        {point}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-8 text-xs text-muted-foreground">
                    Gerçek ürün ekranı · Örnek kayıtlar
                  </p>
                </div>
                <div className="relative flex min-h-[330px] items-start justify-center overflow-hidden border-t bg-muted p-5 pb-0 lg:border-l lg:border-t lg:pt-10">
                  {item.id === "tracking" ? (
                    <Image
                      src={item.image}
                      alt={item.alt}
                      width={item.width}
                      height={item.height}
                      sizes="300px"
                      className="max-h-[470px] w-[260px] rounded-t-2xl border border-border object-cover object-top shadow-xl"
                    />
                  ) : (
                    <Image
                      src={item.image}
                      alt={item.alt}
                      width={item.width}
                      height={item.height}
                      sizes="(max-width: 1024px) 90vw, 720px"
                      className={`rounded-t-lg border border-border shadow-xl ${item.id === "order" ? "h-[350px] w-full object-cover object-left-top sm:h-[440px]" : "h-[440px] w-full object-cover object-[50%_35%]"}`}
                    />
                  )}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}

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
            ].map(({ icon: Icon, title, text, tag }) => (
              <div key={tag} className="border-t border-border py-7">
                <Icon className="mb-5 size-6 text-primary" />
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
    <section className="bg-navy py-20 text-navy-foreground sm:py-24">
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
            <div key={n} className="border-t border-navy-foreground/25 pt-6">
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

export function RoadmapSection() {
  return (
    <section className="border-y bg-background py-16">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[1.1fr_1fr_1fr]">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Bir sonraki adımlar
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-navy">
            Servisinizle birlikte gelişir.
          </h2>
          <p className="mt-4 text-xs leading-6 text-muted-foreground">
            Planlanan geliştirmeler henüz kullanıma açık değildir. Kapsam ve
            sıra, servislerden gelen geri bildirimlerle netleşir.
          </p>
        </div>
        {[
          {
            phase: "Faz 1",
            name: "e-Fatura & e-Arşiv",
            text: "Servis işlemleri ile elektronik belge süreçlerini birbirine bağlamak.",
          },
          {
            phase: "Faz 2",
            name: "Çoklu şube yönetimi",
            text: "Birden fazla şubenin işleyişini ortak bir görünümden takip etmek.",
          },
        ].map((item) => (
          <div key={item.phase} className="rounded-xl border bg-card p-6">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {item.phase} <span className="mx-2">/</span> Yakında · Planlanan
            </p>
            <h3 className="mt-5 text-lg font-semibold text-navy">
              {item.name}
            </h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {item.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
