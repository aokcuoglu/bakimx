/**
 * Client-safe formatters (no Node-only deps).
 *
 * #861: gövdeler `@/lib/format-date`'e taşındı (Europe/Istanbul sabit); mevcut
 * çağıranlar için adlar ve imzalar aynı kalır.
 */
export { formatTrDate as formatDate, formatTrDateTime as formatDateTime } from "./format-date"
