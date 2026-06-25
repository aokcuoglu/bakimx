# Premium Checkout Redesign — Split-Panel Wizard

Date: 2026-06-25
Status: Approved (design), implementation in progress

## Problem

`PurchaseWizard` (used at public `/satin-al` and in-app `/billing/checkout`) renders
as a small `max-w-4xl` card floating in a large white void on the public page. It does
not fill the page and does not feel premium for a paid purchase flow.

## Goal

A premium, branded, full-bleed split-panel checkout that fills the viewport on the
public flow and stays polished (contained) in-app. Mobile-first preserved.

## Approach: branded navy split, context-aware

The wizard renders a two-column split internally:

- **Left — `BrandRail`** (new component, replaces light `value-panel.tsx`): dark navy
  gradient (`navy` #071F49 → `navy-light` #031432). Contains: `BrandLogo primary-dark`
  (links home), selected-package price card, ✓ value-prop list (from `pkg.highlights`),
  trust badges (iptal / 🔒 güvenli / 🇹🇷). On the summary step (step 2) it switches to an
  order-summary view (Paket / Dönem / Kullanıcı / Toplam). Public mode also shows legal
  links (Gizlilik `/privacy`, Kullanım Koşulları `/terms`) in the rail footer.
- **Right — form column** (white): existing 3-step logic, progress bar, framer-motion
  step transitions, and all validation **unchanged**. Only chrome changes.

### Context fork (`mode` prop)

- **public** (`/satin-al`): full-bleed `min-h-[100dvh]` split, edge-to-edge. The landing
  `Header`/`Footer` are **dropped** on this page (Stripe-style focused checkout); brand +
  legal links live in the rail. Right column vertically centers the form with a readable
  max-width.
- **inapp** (`/billing/checkout`): same split, but a **contained rounded card**
  (`rounded-2xl border shadow-sm overflow-hidden`, `md:min-h-[600px]`) inside the existing
  `AppShell` `<main>`. No full-viewport, no Header removal.

### Mobile

Below `md`, the navy rail collapses to a **compact branded banner** (logo + selected
package + price); the rich highlights/trust/legal block is `hidden md:block`. Form stacks
beneath. No desktop sticky rail on mobile.

### Success (`done`) state

Rendered inside the same split frame: rail shows the order summary, right column shows the
confirmation + havale instructions. Keeps brand consistency.

## Risks

- Removing landing `Header`/`Footer` on `/satin-al` changes navigation (mitigated: logo →
  home + legal links in rail).
- Shared-component `mode` branching complexity.
- Full-height interaction with AppShell scroll (inapp uses contained card, not 100dvh).
- Dark-rail contrast — keep AA (white/70+ text on navy).

No schema, server-action, or validation changes — pure presentation.

## Files

- `src/components/billing/value-panel.tsx` → rewritten as `brand-rail.tsx`
- `src/components/billing/purchase-wizard.tsx` — split frame + mode fork
- `src/app/satin-al/page.tsx` — full-bleed, drop Header/Footer
- `src/app/(app)/billing/checkout/page.tsx` — verify contained frame (likely unchanged)

## QA

- Public `/satin-al`: full-height split on desktop, compact banner + stacked form on mobile,
  3 steps, validation, success screen, legal links work.
- In-app `/billing/checkout`: contained card inside AppShell, no layout break, success works.
- Reduced-motion respected. Lint + typecheck clean.
