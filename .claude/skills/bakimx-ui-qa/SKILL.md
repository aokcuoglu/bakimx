---
name: bakimx-ui-qa
description: Run a BakımX UI and UX quality checklist for mobile-first workshop flows, including intake, customer, vehicle, work order, public token pages, photo checklist, and damage map.
allowed-tools: Read Grep Glob Bash
---

# BakımX UI QA

Review the UI/UX impact of the current implementation.

## Product principles
- Mobile-first usage
- Workshop employees may use it quickly during vehicle intake
- Forms must be simple, fast, and forgiving
- Blue/navy professional SaaS style
- Avoid cluttered desktop-only layouts

Sizing and color rules are fixed: `docs/ui-control-sizing.md` for the 44px mobile
/ 36px `md+` control matrix, `AGENTS.md` for the shadcn primitives and semantic
color tokens. `src/components/ui/control-sizing.test.ts`,
`src/lib/ui-contract.test.ts`, and `src/lib/theme-tokens.test.ts` enforce them at
build time — a visual review that contradicts those tests is wrong.

## Check
1. Mobile responsiveness
2. Tap targets (44px minimum on phones)
3. Form validation clarity
4. Empty states
5. Loading states
6. Error states
7. Public customer-facing page polish
8. Photo checklist usability
9. Damage marking usability
10. WhatsApp/PDF output readability
11. Turkish language consistency
12. Accessibility basics

## Output
- UX blockers
- Mobile issues
- Visual polish suggestions
- Copy/text improvements
- Manual QA flow
