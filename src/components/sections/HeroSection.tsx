"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Pause, Play } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { HERO_SLIDES } from "@/lib/landing/hero-slides";
import { trackMarketingEvent } from "@/lib/marketing-analytics";
import { cn } from "@/lib/utils";

const AUTOPLAY_DELAY_MS = 7_000;

export function HeroSection() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [autoplayOverride, setAutoplayOverride] = useState(false);

  const autoplayAllowed = !prefersReducedMotion || autoplayOverride;
  const isPlaying = autoplayAllowed && !paused;

  useEffect(() => {
    if (!api) return;

    const onSelect = () => setSelectedIndex(api.selectedScrollSnap());
    api.on("select", onSelect);
    api.on("reInit", onSelect);

    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  useEffect(() => {
    if (!api || !isPlaying) return;

    const interval = window.setInterval(
      () => api.scrollNext(),
      AUTOPLAY_DELAY_MS,
    );
    return () => window.clearInterval(interval);
  }, [api, isPlaying]);

  const navigateManually = useCallback((navigate: () => void) => {
    setPaused(true);
    navigate();
  }, []);

  function toggleAutoplay() {
    if (isPlaying) {
      setPaused(true);
      return;
    }

    setAutoplayOverride(true);
    setPaused(false);
  }

  return (
    <section className="relative overflow-hidden bg-navy text-navy-foreground">
      <Carousel
        aria-label="BakımX servis yönetimi özellikleri"
        opts={{
          align: "start",
          duration: prefersReducedMotion ? 0 : 22,
          loop: true,
        }}
        setApi={setApi}
        className="relative"
      >
        <CarouselContent className="-ml-0">
          {HERO_SLIDES.map((slide, index) => {
            const isActive = selectedIndex === index;
            const headingClassName =
              "text-balance text-4xl font-bold leading-[1.05] tracking-tight text-navy-foreground sm:text-5xl lg:text-[3.65rem]";

            return (
              <CarouselItem
                key={slide.id}
                aria-label={`${index + 1} / ${HERO_SLIDES.length}`}
                aria-hidden={!isActive}
                className="pl-0"
              >
                <div className="relative flex min-h-[42rem] items-center overflow-hidden sm:min-h-[40rem] lg:min-h-[39rem]">
                  <Image
                    src={slide.image}
                    alt=""
                    fill
                    loading={index === 0 ? "eager" : "lazy"}
                    sizes="100vw"
                    style={{ objectPosition: slide.imagePosition }}
                    className="object-cover"
                  />
                  <div aria-hidden className="absolute inset-0 bg-navy/25" />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-b from-navy via-navy/90 to-navy/55 sm:via-navy/80 lg:bg-gradient-to-r lg:from-navy lg:from-20% lg:via-navy/90 lg:via-48% lg:to-transparent lg:to-82%"
                  />

                  <div className="relative mx-auto w-full max-w-7xl px-4 pb-32 pt-14 sm:px-6 sm:pb-28 sm:pt-16 lg:px-8 lg:pb-28 lg:pt-20">
                    <div className="max-w-2xl lg:max-w-[39rem]">
                      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-navy-foreground/20 bg-navy/55 px-3 py-1.5 text-xs font-semibold text-navy-foreground backdrop-blur-sm">
                        <span className="size-1.5 rounded-full bg-warning" />
                        {slide.eyebrow}
                      </span>

                      <h1 className={cn(headingClassName, "mt-6")}>
                        {slide.title}{" "}
                        <span className="text-primary">{slide.highlight}</span>
                      </h1>

                      <p className="mt-5 max-w-xl text-base leading-relaxed text-navy-foreground/80 sm:text-lg">
                        {slide.description}
                      </p>

                      <ul className="mt-6 flex flex-col gap-3 text-sm text-navy-foreground/90 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-3">
                        {slide.bullets.map((bullet) => (
                          <li
                            key={bullet}
                            className="inline-flex items-center gap-2"
                          >
                            <Check className="size-4 text-primary" />
                            {bullet}
                          </li>
                        ))}
                      </ul>

                      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Link
                          href="/register"
                          tabIndex={isActive ? 0 : -1}
                          onClick={() =>
                            trackMarketingEvent("trial_cta_click", {
                              cta_location: `hero_${slide.id}_primary`,
                            })
                          }
                          className={buttonVariants({
                            variant: "gradient",
                            size: "lg",
                            className: "h-12 gap-2 px-6 text-sm sm:px-7",
                          })}
                        >
                          Ücretsiz Dene
                          <ArrowRight className="size-4" />
                        </Link>
                        <Link
                          href="/#demo-form"
                          tabIndex={isActive ? 0 : -1}
                          onClick={() =>
                            trackMarketingEvent("demo_cta_click", {
                              cta_location: `hero_${slide.id}_secondary`,
                              destination: "form",
                            })
                          }
                          className={buttonVariants({
                            variant: "navy",
                            size: "lg",
                            className:
                              "h-12 border border-navy-foreground/30 bg-navy/60 px-6 text-sm shadow-none hover:bg-navy",
                          })}
                        >
                          Demo İste
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>

        <div className="pointer-events-none absolute inset-x-0 bottom-7 z-10 sm:bottom-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="pointer-events-auto flex items-center gap-1">
              {HERO_SLIDES.map((slide, index) => (
                <Button
                  key={slide.id}
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`${index + 1}. slayta git: ${slide.eyebrow}`}
                  aria-current={selectedIndex === index ? "true" : undefined}
                  onClick={() => navigateManually(() => api?.scrollTo(index))}
                  className="size-8 rounded-full text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground"
                >
                  <span
                    className={cn(
                      "h-1.5 rounded-full bg-navy-foreground/35 transition-[width,background-color] motion-reduce:transition-none",
                      selectedIndex === index ? "w-7 bg-primary" : "w-2.5",
                    )}
                  />
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={toggleAutoplay}
                aria-label={
                  isPlaying
                    ? "Carousel otomatik geçişini duraklat"
                    : "Carousel otomatik geçişini başlat"
                }
                className="ml-1 size-8 rounded-full border border-navy-foreground/20 bg-navy/55 text-navy-foreground hover:bg-navy hover:text-navy-foreground"
              >
                {isPlaying ? <Pause /> : <Play />}
              </Button>
            </div>

            <div className="pointer-events-auto mr-16 flex items-center gap-2 sm:mr-0">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => navigateManually(() => api?.scrollPrev())}
                aria-label="Önceki slayt"
                className="size-10 rounded-full border border-navy-foreground/25 bg-navy/55 text-navy-foreground backdrop-blur-sm hover:bg-navy hover:text-navy-foreground"
              >
                <ArrowLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => navigateManually(() => api?.scrollNext())}
                aria-label="Sonraki slayt"
                className="size-10 rounded-full border border-navy-foreground/25 bg-navy/55 text-navy-foreground backdrop-blur-sm hover:bg-navy hover:text-navy-foreground"
              >
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </Carousel>
    </section>
  );
}
