import { ref, onUnmounted, type Ref } from 'vue'
import { createControls } from '@webgamekit/controls'
import { musicPlay, musicStop, musicSetTempo, musicCurrentSeconds } from '@webgamekit/music'
import { chartToStrudel, rgSongCps } from './strudelChart'
import {
  LANES,
  NOTE_SPEED_PX_PER_MS,
  HIT_ZONE_RATIO,
  NOTE_HEIGHT,
  NOTE_RADIUS,
  LANE_COLORS,
  LANE_KEYS,
  LANE_DIRECTIONS,
  type RgLane,
  type RhythmNote,
  type RgDifficulty,
  type RgSong,
  type RgInstrument,
  SONGS
} from './config'
import {
  evaluateHit,
  getHitScore,
  getComboMultiplier,
  getAccuracy,
  getGrade,
  findHittableNote,
  findExpiredNotes
} from './rhythmGameUtilities'
import type { RgScore } from '@/stores/rhythmGame'
import type { ScheduledNote } from '@webgamekit/audio'

type Particle = { x: number; y: number; r: number; alpha: number; color: string; lane: RgLane }
type LaneFlash = { alpha: number; result: 'perfect' | 'good' | 'miss' }

type DrawContext = {
  notes: RhythmNote[]
  laneActive: boolean[]
  combo: number
  laneFlashes: LaneFlash[]
}

type GameDeps = {
  canvas: Ref<HTMLCanvasElement | null>
  song: RgSong
  difficulty: RgDifficulty
  instrument: RgInstrument
  startAt: number
  customNotes?: RhythmNote[] | null
  backgroundNotes?: ScheduledNote[] | null
  onScoreUpdate: (data: RgScore) => void
  onSongEnd: () => void
}

const RG_DEFAULT_BPM = 120

const getSongNotes = (song: RgSong, difficulty: RgDifficulty): RhythmNote[] => {
  const songDefinition = SONGS.find((s) => s.id === song)
  return songDefinition ? songDefinition.notes[difficulty].map((n) => ({ ...n })) : []
}

const getSongBpm = (song: RgSong): number => SONGS.find((s) => s.id === song)?.bpm ?? RG_DEFAULT_BPM

/** Trailing time after the last note before the song is considered finished. */
const SONG_END_PAD_MS = 2000

const isSongComplete = (notes: RhythmNote[], currentMs: number): boolean => {
  const last = notes.at(-1)
  return (
    !!last && currentMs > last.time + SONG_END_PAD_MS && notes.every((n) => n.hit !== undefined)
  )
}

/** Set the tempo, play the chart's Strudel audio, and report the start time. */
const playStrudelChart = (
  notes: RhythmNote[],
  bpm: number,
  onStarted: (startSeconds: number) => void
): void => {
  musicSetTempo(rgSongCps(bpm))
  void musicPlay(chartToStrudel(notes, bpm)).then(() => onStarted(musicCurrentSeconds()))
}

const resolveNotes = (deps: GameDeps): RhythmNote[] =>
  deps.song === 'custom' && deps.customNotes?.length
    ? deps.customNotes.map((n) => ({ ...n }))
    : getSongNotes(deps.song, deps.difficulty)

const buildControlsMapping = (
  laneActive: Ref<boolean[]>,
  onPress: (lane: RgLane) => void,
  onRelease: (lane: number) => void
) => ({
  mapping: {
    keyboard: Object.fromEntries([
      ...LANE_KEYS.map((k, i) => [k.toLowerCase(), `lane-${i}`]),
      ...LANE_KEYS.map((k, i) => [k.toUpperCase(), `lane-${i}`]),
      ['ArrowLeft', 'lane-0'],
      ['ArrowDown', 'lane-1'],
      ['ArrowUp', 'lane-2'],
      ['ArrowRight', 'lane-3']
    ]),
    'faux-pad': Object.fromEntries(LANE_DIRECTIONS.map((dir, i) => [dir, `lane-${i}`])),
    gamepad: {
      'dpad-left': 'lane-0',
      'dpad-down': 'lane-1',
      'dpad-up': 'lane-2',
      'dpad-right': 'lane-3'
    }
  },
  onAction: (action: string) => {
    if (!action.startsWith('lane-')) return
    const lane = parseInt(action.split('-')[1]) as RgLane
    laneActive.value = laneActive.value.map((_, i) => i === lane) as boolean[] as [
      boolean,
      boolean,
      boolean,
      boolean
    ]
    onPress(lane)
  },
  onRelease: (action: string) => {
    if (!action.startsWith('lane-')) return
    const lane = parseInt(action.split('-')[1])
    laneActive.value = laneActive.value.map((_, i) =>
      i === lane ? false : laneActive.value[i]
    ) as boolean[]
    onRelease(lane)
  }
})

const spawnParticles = (
  canvas: HTMLCanvasElement,
  particles: Particle[],
  lane: RgLane,
  result: 'perfect' | 'good' | 'miss'
): void => {
  const laneW = canvas.width / LANES
  const cx = laneW * lane + laneW / 2
  const cy = canvas.height * HIT_ZONE_RATIO
  const count = result === 'perfect' ? 8 : result === 'good' ? 5 : 3
  const color = result === 'miss' ? '#ff4040' : LANE_COLORS[lane]
  Array.from({ length: count }, () => {
    particles.push({ x: cx, y: cy, r: 4 + Math.random() * 6, alpha: 1, color, lane })
  })
}

const drawLaneIndicators = (
  ctx: CanvasRenderingContext2D,
  h: number,
  laneW: number,
  laneActive: boolean[]
): void => {
  Array.from({ length: LANES }, (_, lane) => lane).forEach((lane) => {
    const cx = laneW * lane + laneW / 2
    const isActive = laneActive[lane]
    const color = LANE_COLORS[lane]
    ctx.strokeStyle = isActive ? color : `${color}60`
    ctx.lineWidth = isActive ? 4 : 1.5
    ctx.fillStyle = isActive ? `${color}70` : 'transparent'
    ctx.shadowBlur = isActive ? 24 : 0
    ctx.shadowColor = color
    ctx.beginPath()
    ctx.arc(cx, h - 40, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.fillStyle = isActive ? '#ffffff' : `${color}aa`
    ctx.font = `bold 13px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(LANE_KEYS[lane], cx, h - 40)
  })
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

const drawFrame = (
  canvas: HTMLCanvasElement,
  currentMs: number,
  dt: number,
  context: DrawContext,
  particles: Particle[]
): Particle[] => {
  const ctx = canvas.getContext('2d')
  if (!ctx) return particles
  const { width: w, height: h } = canvas
  const laneW = w / LANES
  const hitZoneY = h * HIT_ZONE_RATIO

  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#07070f'
  ctx.fillRect(0, 0, w, h)
  Array.from({ length: LANES - 1 }, (_, i) => i + 1).forEach((i) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(laneW * i, 0)
    ctx.lineTo(laneW * i, h)
    ctx.stroke()
  })

  context.laneActive.forEach((active, lane) => {
    if (!active) return
    const grd = ctx.createLinearGradient(laneW * lane, 0, laneW * (lane + 1), 0)
    grd.addColorStop(0, 'transparent')
    grd.addColorStop(0.5, `${LANE_COLORS[lane]}18`)
    grd.addColorStop(1, 'transparent')
    ctx.fillStyle = grd
    ctx.fillRect(laneW * lane, 0, laneW, h)
  })

  const pulse = 0.55 + 0.1 * Math.sin(currentMs / 300)
  ctx.strokeStyle = `rgba(255,255,255,${pulse})`
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, hitZoneY)
  ctx.lineTo(w, hitZoneY)
  ctx.stroke()

  Array.from({ length: LANES }, (_, lane) => lane).forEach((lane) => {
    ctx.strokeStyle = `${LANE_COLORS[lane]}80`
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(laneW * lane + 4, hitZoneY)
    ctx.lineTo(laneW * (lane + 1) - 4, hitZoneY)
    ctx.stroke()
  })

  context.notes.forEach((note) => {
    if (note.hit !== undefined) return
    const y = hitZoneY - (note.time - currentMs) * NOTE_SPEED_PX_PER_MS
    if (y < -NOTE_HEIGHT || y > h + NOTE_HEIGHT) return
    const x = laneW * note.lane + 6
    const nw = laneW - 12
    const color = LANE_COLORS[note.lane]
    ctx.shadowBlur = 12
    ctx.shadowColor = color
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.roundRect(x, y - NOTE_HEIGHT / 2, nw, NOTE_HEIGHT, NOTE_RADIUS)
    ctx.fill()
    ctx.shadowBlur = 0
  })

  context.laneFlashes.forEach((flash, lane) => {
    if (flash.alpha <= 0) return
    const laneColor = LANE_COLORS[lane]
    const effectColor = flash.result === 'perfect' ? '#ffd740' : laneColor
    const flashColor = flash.result === 'miss' ? '#ff4040' : effectColor
    const hex = (v: number): string => Math.round(v).toString(16).padStart(2, '0')
    const cx = laneW * lane + laneW / 2

    ctx.fillStyle = flashColor + hex(flash.alpha * 100)
    ctx.fillRect(laneW * lane, hitZoneY - 40, laneW, 80)

    if (flash.result === 'perfect') {
      const shockRadius = (1 - flash.alpha) * 90
      ctx.strokeStyle = effectColor + hex(flash.alpha * 200)
      ctx.lineWidth = 2.5
      ctx.shadowBlur = 14
      ctx.shadowColor = effectColor
      ctx.beginPath()
      ctx.arc(cx, hitZoneY, shockRadius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    if (flash.result !== 'miss') {
      const popScale = 1 + (1 - flash.alpha) * 0.9
      const nw = (laneW - 12) * popScale
      ctx.globalAlpha = flash.alpha
      ctx.shadowBlur = 20
      ctx.shadowColor = effectColor
      ctx.fillStyle = effectColor
      ctx.beginPath()
      ctx.roundRect(
        cx - nw / 2,
        hitZoneY - (NOTE_HEIGHT * popScale) / 2,
        nw,
        NOTE_HEIGHT * popScale,
        NOTE_RADIUS
      )
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
    }

    context.laneFlashes[lane].alpha = Math.max(0, flash.alpha - dt * 0.004)
  })

  const alive = particles.filter((p) => p.alpha > 0)
  alive.forEach((p) => {
    ctx.globalAlpha = p.alpha
    ctx.fillStyle = p.color
    ctx.shadowBlur = 8
    ctx.shadowColor = p.color
    ctx.beginPath()
    ctx.arc(p.x + (Math.random() - 0.5) * 20, p.y + (Math.random() - 0.5) * 20, p.r, 0, Math.PI * 2)
    ctx.fill()
    p.alpha -= dt * 0.003
    p.r *= 0.97
  })
  ctx.globalAlpha = 1
  ctx.shadowBlur = 0

  drawLaneIndicators(ctx, h, laneW, context.laneActive)

  if (context.combo > 1) {
    const mult = getComboMultiplier(context.combo)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 14px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`${context.combo}× COMBO${mult > 1 ? ` (×${mult})` : ''}`, w / 2, hitZoneY - 20)
    ctx.textAlign = 'left'
  }

  return alive
}

const applyHitFeedback = (
  result: 'perfect' | 'good' | 'miss',
  lane: RgLane,
  laneFlashes: LaneFlash[],
  canvas: HTMLCanvasElement | null,
  particles: Particle[]
): void => {
  if (result !== 'miss') {
    laneFlashes[lane] = { alpha: 1, result }
    if (canvas) spawnParticles(canvas, particles, lane, result)
  }
}

const clearCanvas = (canvas: HTMLCanvasElement | null): void => {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
}

export const useRhythmGame = (deps: GameDeps) => {
  const score = ref(0)
  const combo = ref(0)
  const maxCombo = ref(0)
  const perfect = ref(0)
  const good = ref(0)
  const miss = ref(0)
  const laneActive = ref<boolean[]>([false, false, false, false])

  let rafId = 0
  let strudelStartSec = 0
  let started = false
  const getCurrentMs = (): number =>
    started ? (musicCurrentSeconds() - strudelStartSec) * 1000 : 0
  let notes: RhythmNote[] = []
  let particles: Particle[] = []
  const laneFlashes: LaneFlash[] = Array.from({ length: LANES }, () => ({
    alpha: 0,
    result: 'perfect' as const
  }))
  let lastFrameTime = 0
  const lastHit = ref<'perfect' | 'good' | 'miss' | null>(null)
  const hitKey = ref(0)
  const progressPct = ref(0)
  const songDurationMs = ref(0)
  const emitScore = (): void =>
    deps.onScoreUpdate({
      score: score.value,
      combo: combo.value,
      maxCombo: maxCombo.value,
      perfect: perfect.value,
      good: good.value,
      miss: miss.value
    })

  const pressLane = (lane: RgLane): void => {
    const currentMs = getCurrentMs()

    const index = findHittableNote(notes, lane, currentMs)
    if (index === -1) return

    const delta = Math.abs(notes[index].time - currentMs)
    const result = evaluateHit(delta)
    notes[index].hit = result

    if (result !== 'miss') {
      const pts = getHitScore(result, combo.value)
      score.value += pts
      combo.value++
      if (combo.value > maxCombo.value) maxCombo.value = combo.value
      if (result === 'perfect') perfect.value++
      else good.value++
    } else {
      miss.value++
      combo.value = 0
    }

    applyHitFeedback(result, lane, laneFlashes, deps.canvas.value, particles)
    lastHit.value = result
    hitKey.value++
    emitScore()
  }

  const gameLoop = (timestamp: number): void => {
    const dt = timestamp - lastFrameTime
    lastFrameTime = timestamp
    const currentMs = getCurrentMs()
    const canvas = deps.canvas.value
    if (!canvas) {
      rafId = requestAnimationFrame(gameLoop)
      return
    }

    const expired = findExpiredNotes(notes, currentMs)
    expired.forEach((i) => {
      notes[i].hit = 'miss'
      miss.value++
      combo.value = 0
      laneFlashes[notes[i].lane] = { alpha: 0.6, result: 'miss' }
      if (deps.canvas.value) spawnParticles(deps.canvas.value, particles, notes[i].lane, 'miss')
    })
    if (expired.length > 0) emitScore()

    const drawContext: DrawContext = {
      notes,
      laneActive: laneActive.value,
      combo: combo.value,
      laneFlashes
    }
    particles = drawFrame(canvas, currentMs, dt, drawContext, particles)
    if (songDurationMs.value > 0) progressPct.value = Math.min(1, currentMs / songDurationMs.value)

    if (started && isSongComplete(notes, currentMs)) {
      musicStop()
      deps.onSongEnd()
      return
    }

    rafId = requestAnimationFrame(gameLoop)
  }

  const init = (): void => {
    notes = resolveNotes(deps)
    songDurationMs.value = notes.at(-1)?.time ?? 0
    lastFrameTime = performance.now()
    rafId = requestAnimationFrame(gameLoop)
    // Notes wait at the top until playback starts; the clock is then anchored to it.
    playStrudelChart(notes, getSongBpm(deps.song), (startSeconds) => {
      strudelStartSec = startSeconds
      started = true
    })
  }

  const destroy = (): void => {
    cancelAnimationFrame(rafId)
    musicStop()
    clearCanvas(deps.canvas.value)
  }

  const mountControls = (touchTarget?: HTMLElement | null) =>
    createControls({
      ...buildControlsMapping(laneActive, pressLane, () => {}),
      keyboardTarget: null,
      touchTarget: touchTarget ?? null
    })

  onUnmounted(destroy)

  return {
    score,
    combo,
    maxCombo,
    perfect,
    good,
    miss,
    laneActive,
    lastHit,
    hitKey,
    init,
    destroy,
    pressLane,
    mountControls,
    songDurationMs,
    progressPct,
    getAccuracy: () => getAccuracy(perfect.value, good.value, miss.value),
    getGrade: () => getGrade(getAccuracy(perfect.value, good.value, miss.value))
  }
}
