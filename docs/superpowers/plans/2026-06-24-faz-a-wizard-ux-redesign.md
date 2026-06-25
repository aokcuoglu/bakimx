# Faz A — Satın Alma Wizard UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mevcut satın alma sihirbazını "iki panel" (Layout A) tasarımına taşımak — geniş 2-kolon form + sabit değer paneli (illüstrasyon + paket faydaları), validation layout-shift bug'ını gidermek, Framer Motion adım geçişleri eklemek. (Tami YOK — havale akışı aynen kalır; o Faz B.)

**Architecture:** `purchase-wizard.tsx` tek bileşeni korunur (form/submit/adım mantığı değişmez), render'ı iki-panel yapıya yeniden kurgulanır; değer paneli ayrı bir `value-panel.tsx`'e çıkarılır; `Field` validation slotu sabit-yükseklik yapılır; adım içeriği `framer-motion`'la animasyonlanır.

**Tech Stack:** Next.js (client component), react-hook-form, **framer-motion@12.40 (zaten kurulu)**, shadcn/ui, Tailwind, lucide-react.

## Global Constraints

- **Paket yöneticisi Bun.** İzinli: `bun run typecheck`, `bun run lint`, `bun run build`, `bun test`. **`bun install`/`add`/`update` ÇALIŞTIRMAYIN** (framer-motion zaten kurulu; stray install Next yamasını bozar).
- **Branch guard:** her görevde önce `git checkout feat/checkout-wizard-tami`. Main checkout başka oturumlarca çekişiliyor — `git add` SADECE görevin adı geçen dosyaları (çalışma ağacında bana ait olmayan untracked/modified dosyalar var: `src/app/page.tsx`, `Footer.tsx`, `Header.tsx`, `jscanify.js` — bunlara DOKUNMAYIN, `git add -A`/`.` KULLANMAYIN).
- **TS strict; yeni `any` yok.** Mevcut react-hook-form `as never` kalıbı korunur (yeni `any` eklemeyin).
- **Mobil-öncelikli**, marka mavi/lacivert, shadcn/ui. Para `formatMinor` ile, fiyatlar **KDV dahil**.
- **Reduced-motion:** `useReducedMotion()` ile `prefers-reduced-motion` saygısı zorunlu.
- **Faz A Tami içermez** — değer panelindeki güven satırı ödeme-yöntemi belirtmez (Faz B ödemeye özel mesajı ekler).
- **Doğrulama:** UI olduğundan TDD yok — her görev `bun run typecheck` + `bun run lint` + `bun run build`; görsel görevlerde manuel QA (`bun dev` → `/fiyatlar` → paket → `/satin-al`).
- Commit sonu trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## File Structure

- **Create:** `src/components/billing/value-panel.tsx` — `ValuePanel({tier,cycle,step,mode})`: seçilen paket özeti + illüstrasyon + faydalar (adım 0-1) veya sipariş özeti (adım 2). Form state'i TÜKETMEZ (saf görsel).
- **Modify:** `src/components/billing/purchase-wizard.tsx` — `Field` slot fix; render iki-panel + ValuePanel; adım geçişlerine framer-motion.

---

### Task 1: `Field` layout-shift fix

**Files:**
- Modify: `src/components/billing/purchase-wizard.tsx:291-298` (the `Field` helper)

**Interfaces:**
- Produces: `Field` artık her zaman sabit-yükseklikli bir validation slotu render eder (hata olsa da olmasa da aynı yükseklik) → mesaj gelince/gidince kayma olmaz.

- [ ] **Step 1: `git checkout feat/checkout-wizard-tami`** ve `git rev-parse --abbrev-ref HEAD` ile doğrula.

- [ ] **Step 2: `Field`'i sabit slotlu yap.** `src/components/billing/purchase-wizard.tsx` içindeki `Field` fonksiyonunu şununla değiştir:

```tsx
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {/* Sabit yükseklikli validation slotu — mesaj gelince/gidince layout kaymaz */}
      <p className="min-h-[16px] text-xs text-destructive leading-4">{error ?? ""}</p>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck + lint.**

Run: `bun run typecheck && bun run lint`
Expected: PASS (0 hata; mevcut pre-existing uyarılar olabilir).

- [ ] **Step 4: Commit.**

```bash
git add src/components/billing/purchase-wizard.tsx
git commit -m "fix(checkout): reserve fixed-height validation slot (no layout shift)"
```

---

### Task 2: `ValuePanel` bileşeni

**Files:**
- Create: `src/components/billing/value-panel.tsx`

**Interfaces:**
- Consumes: `getPlanPackage` (`@/lib/plans-catalog`), `getPlanPriceMinor`/`formatMinor` (`@/lib/billing/pricing`), `PlanTier` (`@/lib/plan`).
- Produces: `ValuePanel({ tier: PlanTier; cycle: "monthly"|"yearly"; step: number })` — adım 0-1'de paket+faydalar, adım 2'de sipariş özeti gösterir.

- [ ] **Step 1: `git checkout feat/checkout-wizard-tami`** doğrula.

- [ ] **Step 2: Dosyayı oluştur.** `src/components/billing/value-panel.tsx`:

```tsx
import { getPlanPackage } from "@/lib/plans-catalog"
import { getPlanPriceMinor, formatMinor } from "@/lib/billing/pricing"
import type { PlanTier } from "@/lib/plan"

type Cycle = "monthly" | "yearly"

/** Sihirbazın sağ paneli (mobilde formun üstünde). Form state tüketmez. */
export function ValuePanel({
  tier,
  cycle,
  step,
}: {
  tier: PlanTier
  cycle: Cycle
  step: number
}) {
  const pkg = getPlanPackage(tier)
  const amount = formatMinor(getPlanPriceMinor(tier, cycle))
  const isSummary = step === 2

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-5">
      {isSummary ? (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Sipariş özeti</p>
          <div className="mt-3 space-y-2 text-sm">
            <Row label="Paket" value={pkg?.name ?? tier} />
            <Row label="Dönem" value={cycle === "monthly" ? "Aylık" : "Yıllık"} />
            <Row label="Kullanıcı" value={String(pkg?.seats ?? "")} />
          </div>
          <div className="mt-3 flex items-baseline justify-between border-t border-primary/15 pt-3">
            <span className="text-sm text-muted-foreground">Toplam (KDV dahil)</span>
            <span className="text-xl font-extrabold text-foreground">{amount}</span>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-lg border border-primary/20 bg-card p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Seçilen paket</p>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-base font-extrabold text-foreground">{pkg?.name}</span>
              <span className="text-base font-extrabold text-foreground">
                {amount}
                <span className="text-[11px] font-medium text-muted-foreground">{cycle === "monthly" ? "/ay" : "/yıl"}</span>
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{pkg?.seats} kullanıcı · KDV dahil</p>
          </div>

          {/* faydalar + illüstrasyon yalnız md+ (mobilde kompakt kalsın) */}
          <div className="hidden md:block">
            <div className="my-4 flex justify-center"><CarIllustration /></div>
            <p className="mb-2 text-xs font-bold text-foreground">Bu pakette kazandıkların</p>
            <ul className="space-y-2 text-xs text-foreground">
              {(pkg?.highlights ?? []).slice(0, 4).map((h) => (
                <li key={h} className="flex gap-2">
                  <span className="font-bold text-emerald-600">✓</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <div className="mt-4 hidden border-t border-primary/15 pt-3 text-[11px] leading-relaxed text-muted-foreground md:block">
        ↩︎ İstediğin an iptal
        <br />🔒 Verilerin güvende
        <br />🇹🇷 Türkiye'deki servisler için
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  )
}

function CarIllustration() {
  return (
    <svg width="120" height="62" viewBox="0 0 120 62" fill="none" aria-hidden="true">
      <rect x="6" y="40" width="108" height="6" rx="3" className="fill-primary/20" />
      <path d="M18 40c0-7 5-13 12-15l8-10c2-3 5-4 9-4h20c5 0 9 2 12 6l8 11c8 1 15 6 15 14v6H18v-8z" className="fill-primary" />
      <path d="M40 16h18v11H32l8-11z" className="fill-primary/20" />
      <path d="M62 16h16c3 0 6 1 8 4l5 7H62V16z" className="fill-primary/20" />
      <circle cx="36" cy="46" r="9" className="fill-foreground" /><circle cx="36" cy="46" r="4" className="fill-muted" />
      <circle cx="88" cy="46" r="9" className="fill-foreground" /><circle cx="88" cy="46" r="4" className="fill-muted" />
    </svg>
  )
}
```

- [ ] **Step 3: Typecheck + lint.**

Run: `bun run typecheck && bun run lint`
Expected: PASS (0 hata).

- [ ] **Step 4: Commit.**

```bash
git add src/components/billing/value-panel.tsx
git commit -m "feat(checkout): add ValuePanel (plan benefits + order summary)"
```

---

### Task 3: İki-panel layout + ValuePanel'i bağla

**Files:**
- Modify: `src/components/billing/purchase-wizard.tsx` (the `return (...)` render bloğu, line 163-288)

**Interfaces:**
- Consumes: `ValuePanel` (Task 2), düzeltilmiş `Field` (Task 1).
- Tüm form/submit/adım mantığı (line 28-161) DEĞİŞMEZ — yalnız render yapısı.

- [ ] **Step 1: `git checkout feat/checkout-wizard-tami`** doğrula.

- [ ] **Step 2: ValuePanel import et.** `purchase-wizard.tsx` import bloğuna ekle (line 23'ten sonra):

```tsx
import { ValuePanel } from "@/components/billing/value-panel"
```

- [ ] **Step 3: Render bloğunu (line 163-288, `return (` … `)` arası) iki-panel yapıyla değiştir.** `if (done) { ... }`'dan SONRAKİ `return (...)` bloğunun tamamını şununla değiştir (adım Card'larının İÇERİĞİ birebir korunur — yalnız sarmalayan yapı + genişlik + ValuePanel değişir):

```tsx
  return (
    <div className="mx-auto max-w-4xl">
      {/* progress (üstte, tam genişlik) */}
      <div className="mb-4 rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium">Adım {step + 1} / {STEPS.length}</span>
          <span className="text-xs text-muted-foreground">{STEPS[step]}</span>
        </div>
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid items-start gap-4 md:grid-cols-[1.5fr_1fr]">
        {/* DEĞER PANELİ — mobilde formun ÜSTÜNDE (order-1), masaüstünde sağda + sticky */}
        <div className="order-1 md:order-2 md:sticky md:top-4">
          <ValuePanel tier={tier} cycle={cycle} step={step} />
        </div>

        {/* FORM — mobilde altta (order-2), masaüstünde solda */}
        <div className="order-2 md:order-1">
          {/* Step 0: plan + cycle */}
          {step === 0 && (
            <Card>
              <CardHeader><CardTitle>Paket seçin</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="inline-flex w-full gap-1 rounded-lg border bg-card p-1">
                  {(["monthly", "yearly"] as const).map((c) => (
                    <button key={c} type="button" onClick={() => setCycle(c)}
                      className={cn("flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors", cycle === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                      {c === "monthly" ? "Aylık" : "Yıllık (2 ay bedava)"}
                    </button>
                  ))}
                </div>
                <div className="grid gap-3">
                  {PLAN_PACKAGES.map((pkg) => {
                    const selected = tier === pkg.tier
                    const minor = getPlanPriceMinor(pkg.tier, cycle)
                    return (
                      <button key={pkg.tier} type="button" onClick={() => setTier(pkg.tier)}
                        className={cn("flex items-center justify-between rounded-xl border p-4 text-left transition-colors", selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                        <div>
                          <p className="font-semibold text-foreground">{pkg.name}</p>
                          <p className="text-xs text-muted-foreground">{pkg.tagline} · {pkg.seats} kullanıcı</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-foreground">{formatMinor(minor)}</p>
                          <p className="text-[11px] text-muted-foreground">{cycle === "monthly" ? "/ay" : "/yıl"} · KDV dahil</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="button" size="lg" className="h-12 gap-2" onClick={() => next([])}>Devam <ChevronRight className="size-4" /></Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 1: account (public) + invoice info */}
          {step === 1 && (
            <Card>
              <CardHeader><CardTitle>{mode === "public" ? "Hesap & fatura bilgisi" : "Fatura bilgisi"}</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {mode === "public" && (
                  <>
                    <Field label="İş yeri adı" error={fieldError(formState, "workshopName")}><Input {...register("workshopName" as never)} /></Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Ad" error={fieldError(formState, "firstName")}><Input {...register("firstName" as never)} /></Field>
                      <Field label="Soyad" error={fieldError(formState, "lastName")}><Input {...register("lastName" as never)} /></Field>
                    </div>
                    <Field label="E-posta" error={fieldError(formState, "email")}><Input type="email" {...register("email" as never)} /></Field>
                    <Field label="Şifre" error={fieldError(formState, "password")}><Input type="password" {...register("password" as never)} /></Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Telefon" error={fieldError(formState, "phone")}><Input {...register("phone" as never)} /></Field>
                      <Field label="Şehir" error={fieldError(formState, "city")}><Input {...register("city" as never)} /></Field>
                    </div>
                    <Field label="Adres" error={fieldError(formState, "address")}><Input {...register("address" as never)} /></Field>
                  </>
                )}
                <Field label="Fatura ünvanı" error={fieldError(formState, "invoiceTitle")}><Input {...register("invoiceTitle" as never)} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Vergi / TC no" error={fieldError(formState, "taxNumber")}><Input {...register("taxNumber" as never)} /></Field>
                  <Field label="Vergi dairesi (ops.)" error={fieldError(formState, "taxOffice")}><Input {...register("taxOffice" as never)} /></Field>
                </div>
                {mode === "public" && (
                  <label className="flex items-start gap-2 pt-1 text-xs text-muted-foreground">
                    <input type="checkbox" {...register("kvkkConsent" as never)} className="mt-0.5" />
                    <span><Link href="/privacy" className="text-primary hover:underline" target="_blank">Aydınlatma metnini</Link> okudum, onaylıyorum.</span>
                  </label>
                )}
                <div className="flex justify-between pt-2">
                  <Button type="button" variant="outline" onClick={() => setStep(0)} className="gap-1"><ChevronLeft className="size-4" /> Geri</Button>
                  <Button type="button" size="lg" className="h-12 gap-2"
                    onClick={() => next(mode === "public"
                      ? ["workshopName", "firstName", "lastName", "email", "password", "phone", "city", "address", "invoiceTitle", "taxNumber", "kvkkConsent"]
                      : ["invoiceTitle", "taxNumber"])}>
                    Devam <ChevronRight className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: summary */}
          {step === 2 && (
            <Card>
              <CardHeader><CardTitle>Özet</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Onayladığınızda size havale/EFT talimatı ve referans kodu verilir. Ödeme ekibimizce teyit edilince {mode === "public" ? "hesabınız aktifleşir" : "paketiniz güncellenir"}.</p>
                {mode === "inapp" && (
                  <p className="text-xs text-muted-foreground">Yükseltmede mevcut paketinizin kalan gün kredisi düşülür; kesin tutar onay ekranında görünür.</p>
                )}
                <div className="flex justify-between pt-1">
                  <Button type="button" variant="outline" onClick={() => setStep(1)} className="gap-1"><ChevronLeft className="size-4" /> Geri</Button>
                  <Button type="button" size="lg" disabled={loading} className="h-12 gap-2" onClick={submit}>
                    {loading ? <><Loader2 className="size-4 animate-spin" /> Gönderiliyor…</> : "Siparişi oluştur"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
```

Not: Adım 2'deki eski "Özet" tutar kutusu kaldırıldı çünkü tutar/özet artık sağdaki **ValuePanel**'de (sipariş özeti modunda). Form/submit mantığı (line 28-161) ve `done` ekranı (line 123-161) AYNEN korunur.

- [ ] **Step 4: Typecheck + lint + build.**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: PASS.

- [ ] **Step 5: Manuel QA.** `bun dev` → `http://localhost:3000/fiyatlar` → bir paket "Bu paketi seç" → `/satin-al`'da yeni **iki-panel** wizard: solda geniş form, sağda değer paneli (paket + faydalar + illüstrasyon). Adımlar arası geçişte (2-kolon, mobilde değer paneli üstte) düzgün. TC alanına yazıp silince **kayma yok**. Adım 3'te sağ panel sipariş özetine döner.

- [ ] **Step 6: Commit.**

```bash
git add src/components/billing/purchase-wizard.tsx
git commit -m "feat(checkout): two-pane wizard layout with value panel"
```

---

### Task 4: Framer Motion adım geçişleri

**Files:**
- Modify: `src/components/billing/purchase-wizard.tsx`

**Interfaces:**
- Consumes: `framer-motion` (kurulu), Task 3'ün form-kolon yapısı.

- [ ] **Step 1: `git checkout feat/checkout-wizard-tami`** doğrula.

- [ ] **Step 2: Motion import + reduced-motion.** Import bloğuna ekle:

```tsx
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
```

Bileşen gövdesinde (`const amountMinor = ...` satırından sonra) ekle:

```tsx
  const reduce = useReducedMotion()
```

- [ ] **Step 3: Adım içeriğini AnimatePresence ile sar.** Task 3'teki form kolonunda (`<div className="order-2 md:order-1">` içinde) üç `{step === N && (...)}` bloğunu, dıştan şu sarmalla çevir (içerideki Card'lar aynı kalır):

```tsx
        <div className="order-2 md:order-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={reduce ? false : { opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -14 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {step === 0 && ( /* … Card aynen … */ )}
              {step === 1 && ( /* … Card aynen … */ )}
              {step === 2 && ( /* … Card aynen … */ )}
            </motion.div>
          </AnimatePresence>
        </div>
```

(Yalnız `{step === N && ...}` üçlüsünü `<AnimatePresence>…<motion.div key={step} …>` ile çevreliyorsunuz; Card içerikleri değişmiyor.)

- [ ] **Step 4: "Devam"/"Siparişi oluştur" butonlarına hafif tap micro-interaction (opsiyonel ama önerilen).** Üç ilerleme butonunu (`<Button … onClick={() => next(...)}>` ve submit) `motion`-sarmalı yerine, sadelik için Tailwind `active:scale-[0.98] transition-transform` ekleyin (framer-motion buton sarmalamak yerine). Örn. her ilerleme Button'una `className`'e `active:scale-[0.98] transition-transform` ekleyin. (reduced-motion'da Tailwind `active:scale` zararsız; isteğe bağlı `motion-reduce:active:scale-100`.)

- [ ] **Step 5: Typecheck + lint + build.**

Run: `bun run typecheck && bun run lint && bun run build`
Expected: PASS.

- [ ] **Step 6: Manuel QA.** `bun dev` → `/satin-al` → adımlar arası geçişte yatay slide+fade animasyonu. OS'ta "reduce motion" açıkken animasyon olmamalı (sadece anında değişim). Butona basınca hafif scale.

- [ ] **Step 7: Commit.**

```bash
git add src/components/billing/purchase-wizard.tsx
git commit -m "feat(checkout): framer-motion step transitions (reduced-motion aware)"
```

---

### Task 5: Son doğrulama + tam QA

**Files:** (yok — yalnız doğrulama)

- [ ] **Step 1: `git checkout feat/checkout-wizard-tami`** doğrula.

- [ ] **Step 2: Tüm suite.**

Run: `bun test && bun run lint && bun run typecheck && bun run build`
Expected: hepsi PASS (mevcut testler etkilenmemeli; UI değişikliği test eklemez).

- [ ] **Step 3: Uçtan uca manuel QA (her iki mod).**
  - **Public:** `/fiyatlar` → paket seç → `/satin-al`: iki-panel, geniş 2-kolon form, değer paneli (faydalar+illüstrasyon), motion geçişler, validation kaymasız. Step 3 → sağ panel sipariş özeti → "Siparişi oluştur" → mevcut "Talebiniz alındı" (havale) ekranı.
  - **In-app:** giriş yap → `/billing` → "Yükselt" → `/billing/checkout`: aynı iki-panel (hesap alanları yok, sadece fatura), değer paneli, motion. (Faz A havale akışı.)
  - **Mobil:** dar ekranda değer paneli formun üstünde kompakt, form tek kolon.

- [ ] **Step 4: (Doğrulama görevi — commit yok.)** Sorun bulunursa ilgili görevde düzeltin.

---

## Manuel QA özet kriterleri
1. `/satin-al` ve `/billing/checkout` iki-panel görünür; form artık dar/ince-uzun değil.
2. Form alanlarında validation mesajı gelince/gidince **hiçbir layout kayması yok** (sabit slot).
3. Değer paneli seçilen pakete göre özet + 4 fayda + illüstrasyon gösterir; adım 3'te sipariş özeti.
4. Adım geçişleri Framer Motion ile akıcı; reduced-motion açıkken animasyon yok.
5. Mevcut havale akışı + `done` ekranı + form validasyonu bozulmadı; tüm testler/build yeşil.
