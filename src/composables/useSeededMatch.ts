import { ref, computed, shallowRef, watch } from 'vue'
import { p2pSendData, p2pOnData, type P2PSession } from '@webgamekit/multiplayer-p2p'
import {
  createMatchSeed,
  isLastSurvivor,
  rankMatchResults,
  remainingPlayerIds,
  upsertMatchResult
} from '@/utils/seededMatch'
import type { MatchResult, MatchStartPayload } from '@/types/seededMatch'

export const SOLO_PLAYER_ID = 'solo'

type SeededMatchOptions = {
  channelPrefix: string
  countdownMs: number
  getPlayerIds: () => string[]
  onStart: (payload: MatchStartPayload) => void
  onSurvivor: () => void
}

/**
 * Round flow for games where every player runs the same seeded level on their own screen:
 * the host sends a seed and a start time, each peer reports its result when it is knocked
 * out or the clock runs out, and every peer ranks the same results. The last player still
 * standing is asked to stop so the match can end.
 * @param options - Channel prefix, countdown, player list and round callbacks
 * @returns Results, ranking and the controls to bind, start and report
 */
export const useSeededMatch = (options: SeededMatchOptions) => {
  const session = shallowRef<P2PSession | null>(null)
  const localPeerId = ref('')
  const results = ref<MatchResult[]>([])
  const roster = ref<string[]>([])
  const survivorNotified = ref(false)
  const isRunning = ref(false)

  const startChannel = `${options.channelPrefix}-match-start`
  const resultChannel = `${options.channelPrefix}-match-result`

  const localPlayerId = computed(() => localPeerId.value || SOLO_PLAYER_ID)
  const ranking = computed(() => rankMatchResults(results.value))
  // Players who join the room mid-round sit it out, and players who leave stop counting.
  const matchPlayerIds = computed(() => {
    const present = options.getPlayerIds()
    return roster.value.filter((playerId) => present.includes(playerId))
  })
  const isOver = computed(
    () =>
      results.value.length > 0 &&
      remainingPlayerIds(matchPlayerIds.value, results.value).length === 0
  )

  const beginRound = (payload: MatchStartPayload): void => {
    results.value = []
    roster.value = options.getPlayerIds()
    survivorNotified.value = false
    isRunning.value = true
    options.onStart(payload)
  }

  const recordResult = (result: MatchResult): void => {
    results.value = upsertMatchResult(results.value, result)
  }

  const bind = (joined: P2PSession): void => {
    session.value = joined
    localPeerId.value = joined.peerId
    p2pOnData<MatchStartPayload>(joined, startChannel, beginRound)
    p2pOnData<MatchResult>(joined, resultChannel, (result, peerId) =>
      recordResult({ ...result, playerId: peerId })
    )
  }

  const startMatch = (durationMs: number | null): void => {
    const payload: MatchStartPayload = {
      seed: createMatchSeed(),
      startAt: Date.now() + options.countdownMs,
      durationMs
    }
    if (session.value) p2pSendData(session.value, startChannel, payload)
    beginRound(payload)
  }

  const reportResult = (score: number, isEliminated: boolean): void => {
    const result: MatchResult = {
      playerId: localPlayerId.value,
      score,
      eliminatedAt: isEliminated ? Date.now() : null
    }
    recordResult(result)
    if (session.value) p2pSendData(session.value, resultChannel, result)
  }

  watch(
    () => [results.value, matchPlayerIds.value] as const,
    ([currentResults, playerIds]) => {
      if (!isRunning.value || survivorNotified.value) return
      if (!isLastSurvivor(playerIds, currentResults, localPlayerId.value, roster.value.length)) {
        return
      }
      survivorNotified.value = true
      options.onSurvivor()
    }
  )

  watch(isOver, (over) => {
    if (over) isRunning.value = false
  })

  return {
    localPlayerId,
    results,
    ranking,
    isOver,
    bind,
    startMatch,
    reportResult
  }
}
