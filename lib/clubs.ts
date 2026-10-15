/** The most nominations a club can allow each member per read (a database check matches). */
export const MAX_NOMINATION_LIMIT = 10

export function nominationLimitText(limit: number): string {
  return limit === 1 ? "1 book per member" : `Up to ${limit} books per member`
}
