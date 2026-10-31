import { watch } from 'vue'
import { p2pSendData, p2pOnData, type P2PSession } from '@webgamekit/multiplayer-p2p'
import { useBaseMultiplayerSession } from '@/composables/useBaseMultiplayerSession'
import { useSeededMatch } from '@/composables/useSeededMatch'
import { useBrickBreakerStore } from '@/stores/brickBreaker'
import { MATCHMAKER_ROOM, START_COUNTDOWN_MS } from './config'
import type {
  BbConfigPayload,
  BbGarbagePayload,
  BbPlayer,
  BbScorePayload,
  BbSessionCallbacks,
  UseBrickBreakerSessionOptions
} from './types'

const CHANNEL_PREFIX = 'bb'
const AVATAR_CHANNEL = 'bb-avatar'
const CHAT_CHANNEL = 'bb-chat'
const RESTART_CHANNEL = 'bb-restart'
const CONFIG_CHANNEL = 'bb-config'
const GARBAGE_CHANNEL = 'bb-garbage'
const SCORE_CHANNEL = 'bb-score'

const makePeerPlayer = (
  peerId: string,
  data: { name: string; color: string },
  existing: BbPlayer | undefined
): BbPlayer => ({ id: peerId, name: data.name, color: data.color, score: existing?.score ?? 0 })

/**
 * P2P session for the brick breaker: avatars and chat from the base session, the seeded round
 * flow, the host's match length, live scores, and garbage rows sent to every rival.
 * @param options - Local player identity and room
 * @param callbacks - Round start, incoming garbage, and the last-player-standing signal
 * @returns Session state, the match ranking and broadcast helpers
 */
export const useBrickBreakerSession = (
  options: UseBrickBreakerSessionOptions,
  callbacks: BbSessionCallbacks
) => {
  const store = useBrickBreakerStore()

  const match = useSeededMatch({
    channelPrefix: CHANNEL_PREFIX,
    countdownMs: START_COUNTDOWN_MS,
    getPlayerIds: () => Object.keys(store.players),
    onStart: (payload) => {
      store.resetScores()
      store.phase = 'playing'
      callbacks.onMatchStart(payload)
    },
    onSurvivor: callbacks.onSurvivorFinish
  })

  const sendConfig = (joined: P2PSession): void => {
    const payload: BbConfigPayload = { matchLength: store.matchLength }
    p2pSendData(joined, CONFIG_CHANNEL, payload)
  }

  const bindGameData = (joined: P2PSession): void => {
    match.bind(joined)
    p2pOnData<BbConfigPayload>(joined, CONFIG_CHANNEL, (payload) => {
      store.matchLength = payload.matchLength
    })
    p2pOnData<BbGarbagePayload>(joined, GARBAGE_CHANNEL, (payload) =>
      callbacks.onGarbage(payload.rows)
    )
    p2pOnData<BbScorePayload>(joined, SCORE_CHANNEL, (payload, peerId) =>
      store.setScore(peerId, payload.score)
    )
  }

  const base = useBaseMultiplayerSession<BbPlayer>({
    roomId: options.roomId,
    matchmakerRoom: MATCHMAKER_ROOM,
    channels: { avatar: AVATAR_CHANNEL, chat: CHAT_CHANNEL, restart: RESTART_CHANNEL },
    getProfile: () => ({ name: options.name, color: options.color }),
    setProfile: (name, color) => {
      options.name = name
      options.color = color
    },
    getHostId: () => store.hostId,
    getPlayer: (peerId) => store.players[peerId],
    onUpsertPlayer: (player) => store.upsertPlayer(player),
    onRemovePlayer: (peerId) => store.removePlayer(peerId),
    onAppendMessage: (message) => store.appendMessage(message),
    makeSelfPlayer: (peerId) => ({
      id: peerId,
      name: options.name,
      color: options.color,
      score: 0
    }),
    makePeerPlayer,
    onPeerJoin: (joined, isHost) => {
      if (isHost.value) sendConfig(joined)
    },
    onData: (joined) => bindGameData(joined),
    onRestart: () => {
      store.resetScores()
      store.phase = 'lobby'
    }
  })

  watch(match.isOver, (over) => {
    if (over) store.phase = 'summary'
  })

  watch(
    () => store.matchLength,
    () => {
      if (base.session.value && base.isHost.value) sendConfig(base.session.value)
    }
  )

  const broadcastGarbage = (rows: number): void => {
    if (!base.session.value) return
    const payload: BbGarbagePayload = { rows }
    p2pSendData(base.session.value, GARBAGE_CHANNEL, payload)
  }

  const broadcastScore = (score: number): void => {
    store.setScore(match.localPlayerId.value, score)
    if (!base.session.value) return
    const payload: BbScorePayload = { score }
    p2pSendData(base.session.value, SCORE_CHANNEL, payload)
  }

  return {
    ...base,
    matchmakerRoom: MATCHMAKER_ROOM,
    localPlayerId: match.localPlayerId,
    ranking: match.ranking,
    startMatch: match.startMatch,
    reportResult: match.reportResult,
    broadcastGarbage,
    broadcastScore
  }
}
