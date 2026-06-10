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
import { dictionaryPickRandom, type DictionaryDifficulty } from '@webgamekit/dictionary'
import {
  useWordleMultiplayerStore,
  type WlPlayer,
  type GuessRow,
  type LetterStatus
} from '@/stores/wordleMultiplayer'
import {
  MAX_ATTEMPTS,
  INTERMISSION_MS,
  REANNOUNCE_DELAY_MS,
  POINTS_MAX,
  POINTS_FIRST_BONUS,
  POINTS_MINIMUM
} from './constants'

const ROUND_CHANNEL = 'wl-round'
const GUESS_CHANNEL = 'wl-guess'
const SCORE_CHANNEL = 'wl-score'
const ROUND_END_CHANNEL = 'wl-round-end'
const AVATAR_CHANNEL = 'wl-avatar'
const HELLO_CHANNEL = 'wl-hello'
const RESTART_CHANNEL = 'wl-restart'
const CONFIG_CHANNEL = 'wl-config'
const CHAT_CHANNEL = 'wl-chat'

type RoundPayload = {
  number: number
  word: string
  endsAt: number | null
}

type GuessPayload = {
  playerId: string
  guess: string
  result: LetterStatus[]
}

type ScorePayload = {
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

type UseWordleMultiplayerSessionOptions = {
  name: string
  color: string
  roomId: string
}

type WlContext = {
  options: UseWordleMultiplayerSessionOptions
  store: ReturnType<typeof useWordleMultiplayerStore>
  session: Ref<P2PSession | null>
  localPeerId: Ref<string>
  solvedCount: Ref<number>
  scoreCache: Map<string, number>
  isHost: ComputedRef<boolean>
  endRound: () => void
}

/**
 * Compute Wordle-style color result for a guess against the target word.
 * @param guess - Player's guessed word (uppercase).
 * @param word - The target word (uppercase).
 * @returns Per-letter status array.
 */
export const computeGuessResult = (guess: string, word: string): LetterStatus[] => {
  const result: LetterStatus[] = Array(guess.length).fill('absent')
  const wordChars = [...word.toUpperCase()]
  const guessChars = [...guess.toUpperCase()]

  guessChars.forEach((letter, i) => {
    if (letter === wordChars[i]) {
      result[i] = 'correct'
      wordChars[i] = ''
    }
  })

  guessChars.forEach((letter, i) => {
    if (result[i] === 'correct') return
    const index = wordChars.indexOf(letter)
    if (index !== -1) {
      result[i] = 'present'
      wordChars[index] = ''
    }
  })

  return result
}

const computeScore = (
  attempts: number,
  maxAttempts: number,
  endsAt: number | null,
  roundDuration: number,
  isFirst: boolean
): number => {
  const attemptRatio = 1 - (attempts - 1) / maxAttempts
  const timeRatio = endsAt ? Math.max(0, endsAt - Date.now()) / (roundDuration * 1000) : 0
  const base = Math.max(
    POINTS_MINIMUM,
    Math.round(POINTS_MAX * (0.6 * attemptRatio + 0.4 * timeRatio))
  )
  return base + (isFirst ? POINTS_FIRST_BONUS : 0)
}

const broadcastConfig = (ctx: WlContext, target: P2PSession): void => {
  const payload: ConfigPayload = {
    difficulty: ctx.store.difficulty,
    totalRounds: ctx.store.totalRounds,
    roundDuration: ctx.store.roundDuration
  }
  p2pSendData(target, CONFIG_CHANNEL, payload)
}

const announceSelf = (ctx: WlContext, joined: P2PSession): void => {
  const player: WlPlayer = {
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

const endRoundForContext = (ctx: WlContext, startRound: () => void): void => {
  if (!ctx.session.value || !ctx.isHost.value) return
  const intermissionEndsAt = Date.now() + INTERMISSION_MS
  p2pSendData(ctx.session.value, ROUND_END_CHANNEL, {
    number: ctx.store.round.number,
    intermissionEndsAt
  })
  applyRoundEnd(ctx, intermissionEndsAt)
  if (ctx.store.phase === 'intermission') {
    setTimeout(() => {
      if (ctx.store.phase === 'intermission' && ctx.isHost.value) startRound()
    }, INTERMISSION_MS)
  }
}

const applyRoundEnd = (ctx: WlContext, intermissionEndsAt: number): void => {
  if (ctx.store.round.number >= ctx.store.totalRounds) {
    ctx.store.winnerId = ctx.store.playerList[0]?.id ?? null
    ctx.store.phase = 'summary'
    ctx.store.intermissionEndsAt = null
  } else {
    ctx.store.phase = 'intermission'
    ctx.store.intermissionEndsAt = intermissionEndsAt
  }
}

const bindPeerEvents = (ctx: WlContext, joined: P2PSession): void => {
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

const bindGameEvents = (ctx: WlContext, joined: P2PSession): void => {
  p2pOnData<ChatMessage>(joined, CHAT_CHANNEL, (message) => ctx.store.appendMessage(message))

  p2pOnData<RoundPayload>(joined, ROUND_CHANNEL, (payload) => {
    ctx.store.round = { ...payload, maxAttempts: MAX_ATTEMPTS }
    ctx.store.phase = 'playing'
    ctx.store.resetRound()
    ctx.solvedCount.value = 0
  })

  p2pOnData<GuessPayload>(joined, GUESS_CHANNEL, (payload) => {
    ctx.store.addGuessRow(payload.playerId, { word: payload.guess, result: payload.result })
  })

  p2pOnData<ScorePayload>(joined, SCORE_CHANNEL, (payload) => {
    ctx.store.addScore(payload.playerId, payload.points)
    ctx.store.solvedPlayers = { ...ctx.store.solvedPlayers, [payload.playerId]: 1 }
    ctx.solvedCount.value += 1
    const allSolved = ctx.solvedCount.value >= Object.keys(ctx.store.players).length
    if (allSolved && ctx.isHost.value) ctx.endRound()
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
    ctx.solvedCount.value = 0
  })
}

const initSessionForContext = (ctx: WlContext, roomId: string): void => {
  if (!p2pIsSupported()) return
  const joined = p2pJoin(roomId)
  ctx.session.value = joined
  ctx.localPeerId.value = joined.peerId
  announceSelf(ctx, joined)
  bindPeerEvents(ctx, joined)
  bindGameEvents(ctx, joined)
}

/**
 * Manage a Wordle Multiplayer session (peers, chat, round lifecycle, scoring).
 * @param options - Session configuration.
 * @returns Session controls and reactive state for the consuming view.
 */
export const useWordleMultiplayerSession = (options: UseWordleMultiplayerSessionOptions) => {
  const store = useWordleMultiplayerStore()
  const session = ref<P2PSession | null>(null)
  const localPeerId = ref<string>('')
  const solvedCount = ref(0)
  const scoreCache = new Map<string, number>()
  const isHost = computed(() => store.hostId === localPeerId.value && localPeerId.value !== '')

  const startRound = (): void => {
    if (!isHost.value || !session.value) return
    broadcastConfig(ctx, session.value)
    const nextNumber = store.round.number + 1
    const word = dictionaryPickRandom(store.difficulty)
    const endsAt = store.roundDuration > 0 ? Date.now() + store.roundDuration * 1000 : null
    const payload: RoundPayload = { number: nextNumber, word, endsAt }
    store.round = { ...payload, maxAttempts: MAX_ATTEMPTS }
    store.phase = 'playing'
    store.resetRound()
    solvedCount.value = 0
    p2pSendData(session.value, ROUND_CHANNEL, payload)
  }

  const endRound = (): void => endRoundForContext(ctx, startRound)

  const ctx: WlContext = {
    options,
    store,
    session,
    localPeerId,
    solvedCount,
    scoreCache,
    isHost,
    endRound
  }

  const submitGuess = (guess: string): void => {
    if (!session.value) return
    const result = computeGuessResult(guess, store.round.word)
    const row: GuessRow = { word: guess.toUpperCase(), result }
    store.addGuessRow(localPeerId.value, row)
    p2pSendData(session.value, GUESS_CHANNEL, {
      playerId: localPeerId.value,
      guess: guess.toUpperCase(),
      result
    })

    const isSolved = result.every((s) => s === 'correct')
    const myGuesses = store.playerGuesses[localPeerId.value] ?? []
    const isOutOfAttempts = myGuesses.length >= store.round.maxAttempts

    if (isSolved || isOutOfAttempts) {
      const isFirst = Object.keys(store.solvedPlayers).length === 0
      const points = isSolved
        ? computeScore(
            myGuesses.length,
            store.round.maxAttempts,
            store.round.endsAt,
            store.roundDuration,
            isFirst
          )
        : 0
      store.addScore(localPeerId.value, points)
      store.solvedPlayers = { ...store.solvedPlayers, [localPeerId.value]: 1 }
      solvedCount.value += 1
      p2pSendData(session.value, SCORE_CHANNEL, { playerId: localPeerId.value, points })
      const allSolved = solvedCount.value >= Object.keys(store.players).length
      if (allSolved && isHost.value) endRound()
    }
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
    if (!isHost.value || !session.value) return
    p2pSendData(session.value, RESTART_CHANNEL, { ts: Date.now() })
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
    solvedCount.value = 0
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
    submitGuess,
    broadcastChat,
    updateProfile,
    restartGame,
    init,
    reconnect
  }
}
