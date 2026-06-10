import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue'
import {
  p2pJoin,
  p2pLeave,
  p2pOnPeerJoin,
  p2pOnPeerLeave,
  p2pSendData,
  p2pOnData,
  p2pIsSupported,
  type P2PSession
} from '@webgamekit/multiplayer-p2p'
import { chatMessageCreate, type ChatMessage } from '@webgamekit/chat'
import {
  dictionaryGetWords,
  dictionaryGetBoggleWords,
  dictionaryGetDefinition,
  type DictionaryDifficulty
} from '@webgamekit/dictionary'
import {
  useSquaresMultiplayerStore,
  type WmPlayer,
  type WmClaimedWord
} from '@/stores/squaresMultiplayer'
import {
  INTERMISSION_MS,
  REANNOUNCE_DELAY_MS,
  GRID_SIZE,
  WORD_COUNT,
  MIN_WORD_LENGTH,
  MAX_WORD_LENGTH,
  MIN_VALID_WORDS
} from './constants'
import {
  enumerateGridWords,
  generateGrid,
  scoreWord,
  shuffleArray
} from './squaresMultiplayerUtilities'

const ROUND_CHANNEL = 'sm-round'
const WORD_CLAIM_CHANNEL = 'sm-claim'
const ROUND_END_CHANNEL = 'sm-round-end'
const AVATAR_CHANNEL = 'sm-avatar'
const HELLO_CHANNEL = 'sm-hello'
const RESTART_CHANNEL = 'sm-restart'
const CONFIG_CHANNEL = 'sm-config'
const CHAT_CHANNEL = 'sm-chat'

type RoundPayload = {
  number: number
  grid: string[][]
  validWords: string[]
  endsAt: number | null
}

type WordClaimPayload = {
  word: string
  playerId: string
  points: number
}

type RoundEndPayload = {
  number: number
  intermissionEndsAt: number
}

type ConfigPayload = {
  difficulty: DictionaryDifficulty
  totalRounds: number
  roundDuration: number
}

type UseSquaresMultiplayerSessionOptions = {
  name: string
  color: string
  roomId: string
}

type WmContext = {
  options: UseSquaresMultiplayerSessionOptions
  store: ReturnType<typeof useSquaresMultiplayerStore>
  session: Ref<P2PSession | null>
  localPeerId: Ref<string>
  scoreCache: Map<string, number>
  isHost: ComputedRef<boolean>
  endRound: () => void
}

const broadcastConfig = (ctx: WmContext, target: P2PSession): void => {
  const payload: ConfigPayload = {
    difficulty: ctx.store.difficulty,
    totalRounds: ctx.store.totalRounds,
    roundDuration: ctx.store.roundDuration
  }
  p2pSendData(target, CONFIG_CHANNEL, payload)
}

const announceSelf = (ctx: WmContext, joined: P2PSession): void => {
  const player: WmPlayer = {
    id: joined.peerId,
    name: ctx.options.name,
    color: ctx.options.color,
    score: 0
  }
  ctx.store.upsertPlayer(player)
  p2pSendData(joined, AVATAR_CHANNEL, { name: ctx.options.name, color: ctx.options.color })
  setTimeout(() => {
    p2pSendData(joined, AVATAR_CHANNEL, { name: ctx.options.name, color: ctx.options.color })
  }, REANNOUNCE_DELAY_MS)
}

const endRoundForContext = (ctx: WmContext, startRound: () => void): void => {
  if (!ctx.isHost.value) return
  const intermissionEndsAt = Date.now() + INTERMISSION_MS
  if (ctx.session.value) {
    p2pSendData(ctx.session.value, ROUND_END_CHANNEL, {
      number: ctx.store.round.number,
      intermissionEndsAt
    })
  }
  applyRoundEnd(ctx, intermissionEndsAt)
  if (ctx.store.phase === 'intermission') {
    setTimeout(() => {
      if (ctx.store.phase === 'intermission' && ctx.isHost.value) startRound()
    }, INTERMISSION_MS)
  }
}

const applyRoundEnd = (ctx: WmContext, intermissionEndsAt: number): void => {
  if (ctx.store.round.number >= ctx.store.totalRounds) {
    ctx.store.winnerId = ctx.store.playerList[0]?.id ?? null
    ctx.store.phase = 'summary'
    ctx.store.intermissionEndsAt = null
  } else {
    ctx.store.phase = 'intermission'
    ctx.store.intermissionEndsAt = intermissionEndsAt
  }
}

const bindPeerEvents = (ctx: WmContext, joined: P2PSession): void => {
  p2pOnPeerJoin(joined, (peerId) => {
    p2pSendData(joined, AVATAR_CHANNEL, { name: ctx.options.name, color: ctx.options.color })
    p2pSendData(joined, HELLO_CHANNEL, { id: peerId })
    if (ctx.isHost.value) broadcastConfig(ctx, joined)
  })

  p2pOnPeerLeave(joined, (peerId) => {
    const player = ctx.store.players[peerId]
    if (player) {
      ctx.scoreCache.set(peerId, player.score)
      const leaveMessage: ChatMessage = {
        id: crypto.randomUUID(),
        senderId: 'system',
        senderName: 'System',
        text: `${player.name} left the game`,
        timestamp: Date.now(),
        kind: 'system'
      }
      ctx.store.appendMessage(leaveMessage)
    }
    ctx.store.removePlayer(peerId)
    const activePhase = ctx.store.phase === 'playing' || ctx.store.phase === 'intermission'
    if (activePhase && Object.keys(ctx.store.players).length <= 1) {
      ctx.store.winnerId = ctx.store.playerList[0]?.id ?? null
      ctx.store.phase = 'summary'
    }
  })

  p2pOnData<{ id: string }>(joined, HELLO_CHANNEL, () => {
    p2pSendData(joined, AVATAR_CHANNEL, { name: ctx.options.name, color: ctx.options.color })
  })

  p2pOnData<{ name: string; color: string }>(joined, AVATAR_CHANNEL, (payload, peerId) => {
    const existing = ctx.store.players[peerId]
    const cachedScore = ctx.scoreCache.get(peerId) ?? 0
    ctx.store.upsertPlayer({
      id: peerId,
      name: payload.name,
      color: payload.color,
      score: existing?.score ?? cachedScore
    })
  })

  p2pOnData<ConfigPayload>(joined, CONFIG_CHANNEL, (payload) => {
    ctx.store.difficulty = payload.difficulty
    ctx.store.totalRounds = payload.totalRounds
    ctx.store.roundDuration = payload.roundDuration
  })
}

const bindGameEvents = (ctx: WmContext, joined: P2PSession): void => {
  p2pOnData<ChatMessage>(joined, CHAT_CHANNEL, (message) => ctx.store.appendMessage(message))

  p2pOnData<RoundPayload>(joined, ROUND_CHANNEL, (payload) => {
    ctx.store.round = {
      number: payload.number,
      grid: payload.grid,
      validWords: payload.validWords,
      endsAt: payload.endsAt
    }
    ctx.store.phase = 'playing'
    ctx.store.resetRound()
  })

  p2pOnData<WordClaimPayload>(joined, WORD_CLAIM_CHANNEL, (payload) => {
    const claim: WmClaimedWord = {
      word: payload.word,
      playerId: payload.playerId,
      points: payload.points
    }
    ctx.store.addClaim(claim)
    ctx.store.addScore(payload.playerId, payload.points)
    const allClaimed = ctx.store.claimedWords.length >= ctx.store.round.validWords.length
    if (allClaimed && ctx.isHost.value) ctx.endRound()
  })

  p2pOnData<RoundEndPayload>(joined, ROUND_END_CHANNEL, (payload) => {
    applyRoundEnd(ctx, payload.intermissionEndsAt)
  })

  p2pOnData<{ ts: number }>(joined, RESTART_CHANNEL, () => {
    const preserved = Object.fromEntries(
      Object.entries(ctx.store.players).map(([id, p]) => [id, { ...p, score: 0 }])
    )
    ctx.store.$patch({
      players: preserved,
      winnerId: null,
      intermissionEndsAt: null,
      messages: []
    })
    ctx.store.resetRound()
  })
}

const initSessionForContext = (ctx: WmContext, roomId: string): void => {
  if (!p2pIsSupported()) {
    ctx.localPeerId.value = crypto.randomUUID()
    ctx.store.upsertPlayer({
      id: ctx.localPeerId.value,
      name: ctx.options.name,
      color: ctx.options.color,
      score: 0
    })
    return
  }
  const joined = p2pJoin(roomId)
  ctx.session.value = joined
  ctx.localPeerId.value = joined.peerId
  announceSelf(ctx, joined)
  bindPeerEvents(ctx, joined)
  bindGameEvents(ctx, joined)
}

const buildEligibleWords = (difficulty: DictionaryDifficulty): string[] => {
  const all =
    difficulty === 'easy'
      ? [...dictionaryGetWords('easy')]
      : difficulty === 'medium'
        ? [...dictionaryGetWords('easy'), ...dictionaryGetWords('medium')]
        : [
            ...dictionaryGetWords('easy'),
            ...dictionaryGetWords('medium'),
            ...dictionaryGetWords('hard')
          ]

  return [...new Set(all)].filter(
    (w) => w.length >= MIN_WORD_LENGTH && w.length <= MAX_WORD_LENGTH && !w.includes(' ')
  )
}

/**
 * Manage a Wordly Multiplayer session (peers, chat, round lifecycle, word claiming).
 * @param options - Session configuration.
 * @returns Session controls and reactive state for the consuming view.
 */
export const useSquaresMultiplayerSession = (options: UseSquaresMultiplayerSessionOptions) => {
  const store = useSquaresMultiplayerStore()
  const session = ref<P2PSession | null>(null)
  const localPeerId = ref<string>('')
  const scoreCache = new Map<string, number>()
  const isHost = computed(() => store.hostId === localPeerId.value && localPeerId.value !== '')

  const startRound = (): void => {
    if (!isHost.value) return
    if (session.value) broadcastConfig(ctx, session.value)

    const eligible = buildEligibleWords(store.difficulty)
    const candidates = shuffleArray(eligible)

    const { grid } = Array.from({ length: 5 }).reduce<{
      grid: string[][]
      placedWords: string[]
    }>(
      (best, _, attempt) => {
        if (best.placedWords.length >= MIN_VALID_WORDS) return best
        const wordSet = candidates.slice(attempt * WORD_COUNT, (attempt + 1) * WORD_COUNT)
        return generateGrid(wordSet, GRID_SIZE)
      },
      { grid: [], placedWords: [] }
    )

    const boggleSet = new Set(dictionaryGetBoggleWords().map((w) => w.toUpperCase()))
    const validWords = enumerateGridWords(grid, boggleSet).filter((w) => dictionaryGetDefinition(w))

    const nextNumber = store.round.number + 1
    const endsAt = store.roundDuration > 0 ? Date.now() + store.roundDuration * 1000 : null

    const payload: RoundPayload = { number: nextNumber, grid, validWords, endsAt }
    store.round = { number: nextNumber, grid, validWords, endsAt }
    store.phase = 'playing'
    store.resetRound()
    if (session.value) p2pSendData(session.value, ROUND_CHANNEL, payload)
  }

  const endRound = (): void => endRoundForContext(ctx, startRound)

  const ctx: WmContext = {
    options,
    store,
    session,
    localPeerId,
    scoreCache,
    isHost,
    endRound
  }

  const submitWord = (word: string): void => {
    const upperWord = word.toUpperCase()
    const isValid = store.round.validWords.some((w) => w.toUpperCase() === upperWord)
    if (!isValid) return
    const alreadyClaimed = store.claimedWords.some((cw) => cw.word.toUpperCase() === upperWord)
    if (alreadyClaimed) return

    const points = scoreWord(upperWord)
    const claim: WmClaimedWord = { word: upperWord, playerId: localPeerId.value, points }
    store.addClaim(claim)
    store.addScore(localPeerId.value, points)
    if (session.value) p2pSendData(session.value, WORD_CLAIM_CHANNEL, claim)

    const allClaimed = store.claimedWords.length >= store.round.validWords.length
    if (allClaimed && isHost.value) endRound()
  }

  const broadcastChat = (text: string): void => {
    if (!session.value) return
    const message = chatMessageCreate(localPeerId.value, options.name, text)
    if (!message) return
    store.appendMessage(message)
    p2pSendData(session.value, CHAT_CHANNEL, message)
  }

  const updateProfile = (name: string, color: string): void => {
    options.name = name
    options.color = color
    const existing = store.players[localPeerId.value]
    store.upsertPlayer({ id: localPeerId.value, name, color, score: existing?.score ?? 0 })
    if (session.value) p2pSendData(session.value, AVATAR_CHANNEL, { name, color })
  }

  const restartGame = (): void => {
    if (!isHost.value) return
    if (session.value) p2pSendData(session.value, RESTART_CHANNEL, { ts: Date.now() })
    const preserved = Object.fromEntries(
      Object.entries(store.players).map(([id, p]) => [id, { ...p, score: 0 }])
    )
    store.$patch({
      players: preserved,
      winnerId: null,
      intermissionEndsAt: null,
      messages: []
    })
    store.resetRound()
    startRound()
  }

  const init = (): void => initSessionForContext(ctx, options.roomId)

  const reconnect = (newRoomId: string): void => {
    destroy()
    initSessionForContext(ctx, newRoomId)
  }

  const destroy = (): void => {
    if (session.value) {
      p2pLeave(session.value)
      session.value = null
    }
    store.reset()
  }

  onUnmounted(destroy)

  return {
    session,
    localPeerId,
    isHost,
    startRound,
    endRound,
    submitWord,
    broadcastChat,
    updateProfile,
    restartGame,
    init,
    reconnect
  }
}
