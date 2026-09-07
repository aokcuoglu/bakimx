"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  const [autoplayOverride, setAutoplayOverride] = useState<boolean | null>(
    null,
  );
  const isPlaying = autoplayOverride ?? !prefersReducedMotion;

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

    const timeout = window.setTimeout(
      () => api.scrollNext(),
      AUTOPLAY_DELAY_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [api, isPlaying, selectedIndex]);

  const navigateManually = useCallback((navigate: () => void) => {
    setAutoplayOverride(false);
    navigate();
  }, []);

  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden border-b border-border bg-navy text-navy-foreground"
    >
      <Carousel
        aria-label="BakımX öne çıkan servis özellikleri"
        opts={{
          align: "start",
          duration: prefersReducedMotion ? 0 : 24,
          loop: true,
        }}
        setApi={setApi}
        className="relative"
      >
        <CarouselContent className="-ml-0">
          {HERO_SLIDES.map((slide, index) => {
            const isActive = selectedIndex === index;
            const headingClassName =
              "max-w-3xl text-balance text-[2.55rem] font-semibold leading-[1.05] tracking-[-0.05em] text-navy-foreground sm:text-6xl lg:text-[4.35rem]";

            return (
              <CarouselItem
                key={slide.id}
                aria-label={`${index + 1} / ${HERO_SLIDES.length}`}
                aria-hidden={!isActive}
                data-hero-slide={slide.id}
                className="pl-0"
              >
                <div className="relative min-h-[46rem] w-full sm:min-h-[48rem] lg:min-h-[43rem]">
                  <Image
                    src={slide.image}
                    alt=""
                    fill
                    loading={index === 0 ? "eager" : "lazy"}
                    sizes="100vw"
                    style={{ objectPosition: slide.imagePosition }}
                    className="object-cover"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-r from-navy via-navy/90 to-navy/20"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-navy/80 via-transparent to-navy/30"
                  />

                  <div className="relative z-10 mx-auto flex min-h-[46rem] w-full max-w-7xl items-center px-5 pb-36 pt-14 sm:min-h-[48rem] sm:px-8 sm:pb-32 sm:pt-16 lg:min-h-[43rem] lg:py-24">
                    <div className="max-w-3xl">
                      <p className="flex w-fit items-center gap-2.5 rounded-full border border-navy-foreground/20 bg-navy/60 px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-navy-foreground backdrop-blur-sm">
                        <span className="size-1.5 rounded-full bg-primary" />
                        {slide.eyebrow}
                      </p>

                      {index === 0 ? (
                        <h1
                          id="hero-title"
                          className={cn(headingClassName, "mt-6")}
                        >
                          {slide.title}
                          <br />
                          <span className="text-primary">
                            {slide.highlight}
                          </span>
                        </h1>
                      ) : (
                        <h2 className={cn(headingClassName, "mt-6")}>
                          {slide.title}
                          <br />
                          <span className="text-primary">
                            {slide.highlight}
                          </span>
                        </h2>
                      )}

                      <p className="mt-6 max-w-2xl text-base leading-7 text-navy-foreground/80 sm:text-lg sm:leading-8">
                        {slide.description}
                      </p>

                      <ul className="mt-6 flex max-w-2xl flex-col gap-3 text-sm text-navy-foreground/90 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-3">
                        {slide.bullets.map((bullet) => (
                          <li
                            key={bullet}
                            className="inline-flex items-center gap-2"
                          >
                            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                              <Check className="size-3.5" />
                            </span>
                            {bullet}
                          </li>
                        ))}
                      </ul>

                      <div className="mt-8 flex flex-col gap-3 pr-16 sm:flex-row sm:flex-wrap sm:pr-0">
                        <Button asChild size="xl" className="h-12 px-5">
                          <Link
                            href="/register"
                            tabIndex={isActive ? 0 : -1}
                            onClick={() =>
                              trackMarketingEvent("trial_cta_click", {
                                cta_location: "hero_primary",
                              })
                            }
                          >
                            Ücretsiz denemeye başlayın <ArrowRight />
                          </Link>
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          size="xl"
                          className="h-12 border-navy-foreground/30 bg-navy/55 px-5 text-navy-foreground hover:bg-navy hover:text-navy-foreground"
                        >
                          <a
                            href="#demo-form"
                            tabIndex={isActive ? 0 : -1}
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

                      <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-navy-foreground/70">
                        <span className="flex items-center gap-1.5">
                          <Check className="size-3.5" />7 iş günü ücretsiz
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Check className="size-3.5" />
                          Kredi kartı gerekmez
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>

        <div className="pointer-events-none absolute inset-x-0 bottom-7 z-20 sm:bottom-8">
          <div className="mx-auto flex max-w-7xl items-end justify-between gap-4 px-5 sm:items-center sm:px-8">
            <div className="pointer-events-auto flex min-w-0 items-center gap-1 rounded-full border border-navy-foreground/15 bg-navy/55 p-1 backdrop-blur-sm">
              {HERO_SLIDES.map((slide, index) => (
                <Button
                  key={slide.id}
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`${index + 1}. slayta git: ${slide.eyebrow}`}
                  aria-current={selectedIndex === index ? "true" : undefined}
                  disabled={!api}
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
                onClick={() => setAutoplayOverride(!isPlaying)}
                aria-label={
                  isPlaying
                    ? "Carousel otomatik geçişini duraklat"
                    : "Carousel otomatik geçişini başlat"
                }
                className="ml-1 size-8 rounded-full text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground"
              >
                {isPlaying ? <Pause /> : <Play />}
              </Button>
            </div>

            <div className="pointer-events-auto mr-14 flex items-center gap-2 sm:mr-16">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => navigateManually(() => api?.scrollPrev())}
                aria-label="Önceki slayt"
                disabled={!api}
                className="size-10 rounded-full border border-navy-foreground/25 bg-navy/55 text-navy-foreground backdrop-blur-sm hover:bg-navy hover:text-navy-foreground"
              >
                <ArrowLeft />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => navigateManually(() => api?.scrollNext())}
                aria-label="Sonraki slayt"
                disabled={!api}
                className="size-10 rounded-full border border-navy-foreground/25 bg-navy/55 text-navy-foreground backdrop-blur-sm hover:bg-navy hover:text-navy-foreground"
              >
                <ArrowRight />
              </Button>
            </div>
          </div>
        </div>
      </Carousel>
    </section>
  );
}
