export type SeatUser = {
  id: string
  role: string
  createdAt: Date
  technicianId: string | null
}

export type SeatInvite = {
  id: string
  createdAt: Date
}

export type SeatAdjustmentSelection = {
  retainedUserIds: string[]
  deactivatedUserIds: string[]
  revokedInviteIds: string[]
  technicianIdsToReview: string[]
}

function oldestFirst<T extends { id: string; createdAt: Date }>(a: T, b: T): number {
  return a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)
}

/** Deterministic seat reduction: oldest owner, then every other user by age. */
export function selectSeatAdjustment(
  users: SeatUser[],
  invites: SeatInvite[],
  limit: number,
): SeatAdjustmentSelection {
  const safeLimit = Math.max(0, limit)
  const sortedUsers = [...users].sort(oldestFirst)
  const oldestOwner = sortedUsers.find((user) => user.role === "owner")
  const orderedUsers = oldestOwner
    ? [oldestOwner, ...sortedUsers.filter((user) => user.id !== oldestOwner.id)]
    : sortedUsers
  const retainedUsers = orderedUsers.slice(0, safeLimit)
  const deactivatedUsers = orderedUsers.slice(safeLimit)
  const remainingInviteSeats = Math.max(0, safeLimit - retainedUsers.length)
  const revokedInvites = [...invites].sort(oldestFirst).slice(remainingInviteSeats)

  return {
    retainedUserIds: retainedUsers.map((user) => user.id),
    deactivatedUserIds: deactivatedUsers.map((user) => user.id),
    revokedInviteIds: revokedInvites.map((invite) => invite.id),
    technicianIdsToReview: [
      ...new Set(
        deactivatedUsers
          .map((user) => user.technicianId)
          .filter((id): id is string => Boolean(id)),
      ),
    ],
  }
}
