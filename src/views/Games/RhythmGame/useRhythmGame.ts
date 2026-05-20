import { ref, onUnmounted, type Ref } from 'vue'
import { createControls } from '@webgamekit/controls'
import { createNoteScheduler } from '@webgamekit/audio'
import {
  LANES,
  NOTE_SPEED_PX_PER_MS,
  HIT_ZONE_RATIO,
  NOTE_HEIGHT,
  NOTE_RADIUS,
  LANE_COLORS,
  LANE_KEYS,
  LANE_DIRECTIONS,
  LANE_FREQS,
  type RgLane,
  type RhythmNote,
  type RgDifficulty,
  type RgSong,
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
  startAt: number
  onScoreUpdate: (data: RgScore) => void
  onSongEnd: () => void
}

const getSongNotes = (song: RgSong, difficulty: RgDifficulty): RhythmNote[] => {
  const songDefinition = SONGS.find((s) => s.id === song)
  return songDefinition ? songDefinition.notes[difficulty].map((n) => ({ ...n })) : []
}

const buildScheduledNotes = (songNotes: RhythmNote[]): ScheduledNote[] =>
  songNotes.map((n) => ({
    time: n.time,
    freq: LANE_FREQS[n.lane],
    duration: 80,
    volume: 0.2,
    waveType: 'triangle'
  }))

const buildControlsMapping = (
  laneActive: Ref<boolean[]>,
  onPress: (lane: RgLane) => void,
  onRelease: (lane: number) => void
) => ({
  mapping: {
    keyboard: Object.fromEntries([
      ...LANE_KEYS.map((k, i) => [k, `lane-${i}`]),
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
    ctx.lineWidth = isActive ? 3 : 1.5
    ctx.fillStyle = isActive ? `${color}30` : 'transparent'
    ctx.shadowBlur = isActive ? 10 : 0
    ctx.shadowColor = color
    ctx.beginPath()
    ctx.arc(cx, h - 40, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.fillStyle = isActive ? color : `${color}aa`
    ctx.font = `bold 13px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(LANE_KEYS[lane], cx, h - 40)
    ctx.fillStyle = `${color}60`
    ctx.font = '10px monospace'
    ctx.fillText(LANE_DIRECTIONS[lane][0].toUpperCase(), cx, h - 16)
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
    const color =
      flash.result === 'perfect'
        ? LANE_COLORS[lane]
        : flash.result === 'good'
          ? '#ffffff'
          : '#ff4040'
    ctx.fillStyle =
      color +
      Math.round(flash.alpha * 40)
        .toString(16)
        .padStart(2, '0')
    ctx.fillRect(laneW * lane, hitZoneY - 30, laneW, 60)
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

export const useRhythmGame = (deps: GameDeps) => {
  const score = ref(0)
  const combo = ref(0)
  const maxCombo = ref(0)
  const perfect = ref(0)
  const good = ref(0)
  const miss = ref(0)
  const laneActive = ref<boolean[]>([false, false, false, false])

  const scheduler = createNoteScheduler()
  let rafId = 0
  let notes: RhythmNote[] = []
  let particles: Particle[] = []
  const laneFlashes: LaneFlash[] = Array.from({ length: LANES }, () => ({
    alpha: 0,
    result: 'perfect' as const
  }))
  let lastFrameTime = 0

  const pressLane = (lane: RgLane): void => {
    const currentMs = scheduler.currentMs
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

    laneFlashes[lane] = { alpha: 1, result }
    if (deps.canvas.value) spawnParticles(deps.canvas.value, particles, lane, result)
    deps.onScoreUpdate({
      score: score.value,
      combo: combo.value,
      maxCombo: maxCombo.value,
      perfect: perfect.value,
      good: good.value,
      miss: miss.value
    })
  }

  const gameLoop = (timestamp: number): void => {
    const dt = timestamp - lastFrameTime
    lastFrameTime = timestamp
    const currentMs = scheduler.currentMs
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
    if (expired.length > 0) {
      deps.onScoreUpdate({
        score: score.value,
        combo: combo.value,
        maxCombo: maxCombo.value,
        perfect: perfect.value,
        good: good.value,
        miss: miss.value
      })
    }

    const drawContext: DrawContext = {
      notes,
      laneActive: laneActive.value,
      combo: combo.value,
      laneFlashes
    }
    particles = drawFrame(canvas, currentMs, dt, drawContext, particles)

    const lastNote = notes.at(-1)
    if (lastNote && currentMs > lastNote.time + 2000 && notes.every((n) => n.hit !== undefined)) {
      scheduler.stop()
      deps.onSongEnd()
      return
    }

    rafId = requestAnimationFrame(gameLoop)
  }

  const init = (): void => {
    notes = getSongNotes(deps.song, deps.difficulty)
    const scheduled = buildScheduledNotes(notes)
    scheduler.start(scheduled, deps.startAt)
    lastFrameTime = performance.now()
    rafId = requestAnimationFrame(gameLoop)
  }

  const destroy = (): void => {
    cancelAnimationFrame(rafId)
    scheduler.stop()
    if (deps.canvas.value) {
      const ctx = deps.canvas.value.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, deps.canvas.value.width, deps.canvas.value.height)
    }
  }

  const mountControls = (target?: HTMLElement | null) => {
    const options = buildControlsMapping(laneActive, pressLane, () => {})
    return createControls({
      ...options,
      keyboardTarget: target ?? null,
      touchTarget: target ?? null
    })
  }

  const getAccuracyValue = () => getAccuracy(perfect.value, good.value, miss.value)
  const getGradeValue = () => getGrade(getAccuracyValue())

  onUnmounted(destroy)

  return {
    score,
    combo,
    maxCombo,
    perfect,
    good,
    miss,
    laneActive,
    init,
    destroy,
    pressLane,
    mountControls,
    getAccuracy: getAccuracyValue,
    getGrade: getGradeValue
  }
}
