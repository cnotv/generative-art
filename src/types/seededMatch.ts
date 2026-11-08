export type MatchStartPayload = {
  seed: number
  startAt: number
  durationMs: number | null
}

export type MatchResult = {
  playerId: string
  score: number
  eliminatedAt: number | null
}
