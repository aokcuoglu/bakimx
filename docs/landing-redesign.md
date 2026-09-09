# Landing redesign — #602

## Audience and message

Small and medium auto-service businesses: the owner or service advisor needs
to see active jobs, customer approvals, parts and outstanding payments without
learning software terminology first. The opening now leads with BakımX's most
distinctive working flows: mobile registration-document reading, chassis-based
vehicle identification and compatible-parts/workshop-stock management.

The page uses a three-story visual banner carousel backed by clearly
representational workshop imagery. The first story always owns the page H1 and
introduces registration reading; the second introduces chassis/parts/stock;
the third covers photo-backed digital work orders. It avoids fabricated
customer quotes, customer counts and performance statistics. The product tour
continues to offer real work-order, vehicle-intake and customer-tracking views.

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

`e2e/landing-hero-carousel.e2e.ts` separately covers the full-bleed banner,
feature-story order, keyboard-operable controls, manual navigation and the
reduced-motion autoplay default. Server-paint, image-loading and hero
conversion-attribution guards remain in `src/app/page.test.ts` and the landing
content tests.

Verification result for #615: lint, TypeScript, production build and the seven
focused landing browser tests pass. The narrowest checked viewport is 320 px;
document width remains 320 px. Axe reports no WCAG A/AA violations in the
tested landing state. The full unit suite passes with 2,153 tests and one
explicitly skipped PostgreSQL integration test.
