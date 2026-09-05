# Landing redesign — #602

## Audience and message

Small and medium auto-service businesses: the owner or service advisor needs
to see active jobs, customer approvals, parts and outstanding payments without
learning software terminology first. The opening message is “Serviste işler
yolunda. Kontrol sizde.”

The page uses a stable product-led opening, a clearly labelled illustrative
service board, and existing product screenshots. It avoids fabricated customer
quotes, customer counts, performance statistics and stock-photo storytelling.
The product tour offers work order, vehicle intake and customer tracking views.

## Product claims checked against the application

| Landing topic                         | Implementation evidence                                                   | Boundary                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Work orders and technician assignment | `src/app/(app)/orders/page.tsx`                                           | Operational status, not a promised completion time                               |
| Registration document reading         | `src/lib/landing/objections.ts`, smart-capture flow                       | User reviews extracted information before confirming                             |
| Intake photos and damage records      | `src/app/(app)/intakes/actions.ts`                                        | Recordkeeping, not a promise to eliminate every dispute                          |
| Customer tracking                     | `src/app/s/[token]/page.tsx`                                              | Shared browser link, no customer app install required                            |
| Stock and parts                       | `src/app/(app)/parts/page.tsx`                                            | Catalog matching and own inventory, no guaranteed external availability          |
| Cashbox and receivables               | `src/app/(app)/cashbox/page.tsx`                                          | Operational collection tracking, not official accounting                         |
| Appointments and reminders            | `src/app/(app)/appointments/page.tsx`, `src/app/(app)/reminders/page.tsx` | Existing features; not labelled “Soon”                                           |
| Trial and packages                    | `src/lib/plan.ts`, `src/lib/plans-catalog.ts`                             | Seven business days; current package details live at `/fiyatlar`                 |
| e-Invoice and multiple branches       | Planned gates in `src/lib/plan.ts`                                        | Future phases, explicitly unavailable today; no release date or price commitment |

Existing demo submission, registration and login destinations remain in use.
The FAQ and FAQPage structured data share `src/lib/faq-data.ts`. Existing FAQ
deep links continue to resolve. Pricing, billing and production configuration
are outside this redesign.

## Verification

`e2e/landing-redesign.e2e.ts` covers keyboard-operated product tabs, mobile
navigation, 320–768 px overflow checks, demo form validation and a mocked
successful submission, FAQ deep links and structured-answer consistency,
WCAG A/AA checks, and a JavaScript-disabled first view. The demo request is
intercepted so acceptance testing does not create real sales leads.

The previous carousel-specific assertions are replaced with these behavioral
checks. The server-paint and hero conversion-attribution regression guards
remain in `src/app/page.test.ts`.

Verification result: lint, TypeScript, production build and all 13 public-page
browser tests passed, including the five new landing tests. The narrowest
checked viewport is 320 px; document width remains 320 px. Axe reports no
WCAG A/AA violations in the tested landing state.

Full unit suite: 2,099 passed, one existing failure in
`src/lib/intake/photo-visibility.test.ts`. Its source scanner expects the shared
`VISIBLE_PHOTO` constant; the pre-existing `src/lib/photos/quota.ts:13` query
uses the equivalent inline `deletedAt: null` filter. Both files are unchanged
from baseline commit `c7de83f7`; the quota implementation came from
`d1fa9920`. This unrelated guard mismatch is not changed by the landing work.
