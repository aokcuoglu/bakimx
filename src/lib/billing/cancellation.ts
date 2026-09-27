const RECENT_ATTEMPT_MS = 24 * 60 * 60 * 1000

/** Provider callbacks can arrive after a terminal attempt; keep a safety window. */
export function canCancelPendingCardOrder(
  attempts: ReadonlyArray<{ status: string; createdAt: Date }>,
  now: Date,
): boolean {
  if (attempts.some((attempt) =>
    attempt.status === "initiated" || attempt.status === "callback_received" || attempt.status === "completed"
  )) return false
  return attempts.every((attempt) => attempt.createdAt.getTime() < now.getTime() - RECENT_ATTEMPT_MS)
}
