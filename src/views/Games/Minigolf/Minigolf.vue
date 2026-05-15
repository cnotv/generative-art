<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, toRaw } from 'vue'
import * as THREE from 'three'
import { createTimelineManager } from '@webgamekit/animation'
import { useSceneViewStore } from '@/stores/sceneView'
import { buildGround, buildWalls, buildHoleMarker } from './helpers/course'
import { createBall, syncBall, shootBall, isBallStopped, resetBall } from './helpers/ball'
import { createAimState, beginDrag, updateDrag, endDrag } from './helpers/input'
import { HOLES, CAMERA_OFFSET_TOPDOWN, MAX_SHOT_POWER, WIN_DISTANCE, MAX_STROKES } from './config'
import { PLAYER_COLORS, randomPick, NAME_ADJECTIVES, NAME_ANIMALS } from '@/utils/playerProfile'
import type { BallState } from './helpers/ball'

interface Player {
  name: string
  color: string
  scores: number[]
}

type Phase = 'wizard' | 'loading' | 'game' | 'summary'

const canvas = ref<HTMLCanvasElement | null>(null)
const store = useSceneViewStore()

const phase = ref<Phase>('wizard')
const wizardStep = ref<1 | 2>(1)
const holeCount = ref(HOLES.length)

const players = ref<Player[]>([
  {
    name: `${randomPick(NAME_ADJECTIVES)} ${randomPick(NAME_ANIMALS)}`,
    color: PLAYER_COLORS[0],
    scores: []
  },
  {
    name: `${randomPick(NAME_ADJECTIVES)} ${randomPick(NAME_ANIMALS)}`,
    color: PLAYER_COLORS[1],
    scores: []
  }
])

const addPlayer = () => {
  if (players.value.length >= 4) return
  const usedColors = players.value.map((p) => p.color)
  const availableColor = PLAYER_COLORS.find((c) => !usedColors.includes(c)) ?? PLAYER_COLORS[0]
  players.value = [
    ...players.value,
    {
      name: `${randomPick(NAME_ADJECTIVES)} ${randomPick(NAME_ANIMALS)}`,
      color: availableColor,
      scores: []
    }
  ]
}

const removePlayer = (index: number) => {
  if (players.value.length <= 2) return
  players.value = players.value.filter((_, i) => i !== index)
}

const holeIndex = ref(0)
const currentPlayerIndex = ref(0)
const strokesThisHole = ref<number[]>([])
const message = ref('')
const waiting = ref(false)

const currentPlayer = computed(() => players.value[currentPlayerIndex.value])
const holes = computed(() => HOLES.slice(0, holeCount.value))

const totalScore = (player: Player) => player.scores.reduce((a, b) => a + b, 0)

const resetToWizard = () => {
  phase.value = 'wizard'
  wizardStep.value = 1
}

let cleanupListeners: (() => void) | null = null

const setOrbitEnabled = (enabled: boolean) => {
  const orbit = toRaw(store.orbitReference)
  if (orbit) orbit.enabled = enabled
}

// ── Extracted helpers (keep arrow functions short) ─────────────────────────

interface GameContext {
  scene: THREE.Scene
  camera: THREE.Camera
  world: import('@dimforge/rapier3d-compat').default.World
  getBall: () => BallState | null
  setBall: (b: BallState) => void
  aim: ReturnType<typeof createAimState>
}

const buildHole = (ctx: GameContext) => {
  ctx.scene.clear()
  const hole = holes.value[holeIndex.value]
  ctx.camera.position.set(
    hole.teePosition[0] + CAMERA_OFFSET_TOPDOWN[0],
    hole.teePosition[1] + CAMERA_OFFSET_TOPDOWN[1],
    hole.teePosition[2] + CAMERA_OFFSET_TOPDOWN[2]
  )
  ctx.camera.lookAt(hole.teePosition[0], 0, hole.teePosition[2])
  buildGround(hole, ctx.scene, ctx.world)
  buildWalls(hole, ctx.scene, ctx.world)
  buildHoleMarker(hole.holePosition, ctx.scene)
  ctx.setBall(createBall(hole.teePosition, ctx.scene, ctx.world))
  ctx.aim.direction.set(0, 0, -1)
  message.value = ''
  waiting.value = false
}

const advancePlayer = (ctx: GameContext) => {
  currentPlayerIndex.value = (currentPlayerIndex.value + 1) % players.value.length
  const ball = ctx.getBall()
  if (ball) resetBall(ball, holes.value[holeIndex.value].teePosition)
  message.value = ''
  waiting.value = false
}

const advanceHole = (ctx: GameContext) => {
  holeIndex.value++
  if (holeIndex.value >= holes.value.length) {
    phase.value = 'summary'
    return
  }
  currentPlayerIndex.value = 0
  strokesThisHole.value = Array(players.value.length).fill(0)
  buildHole(ctx)
}

const resolveTurn = (ctx: GameContext) => {
  const ball = ctx.getBall()
  if (!ball) return
  const strokes = strokesThisHole.value[currentPlayerIndex.value]
  const holePosition = new THREE.Vector3(...holes.value[holeIndex.value].holePosition)
  const isHoled = ball.mesh.position.distanceTo(holePosition) < WIN_DISTANCE
  const isMaxed = strokes >= MAX_STROKES
  if (!isHoled && !isMaxed) return

  waiting.value = true
  const par = holes.value[holeIndex.value].par
  const finalStrokes = isHoled ? strokes : MAX_STROKES
  players.value = players.value.map((p, i) =>
    i === currentPlayerIndex.value ? { ...p, scores: [...p.scores, finalStrokes] } : p
  )
  message.value = isHoled
    ? `${currentPlayer.value.name}: ${strokes} stroke${strokes !== 1 ? 's' : ''}! Par ${par}`
    : `${currentPlayer.value.name}: max strokes`

  const isLastPlayer = currentPlayerIndex.value === players.value.length - 1
  setTimeout(() => {
    if (isLastPlayer) advanceHole(ctx)
    else advancePlayer(ctx)
  }, 1800)
}

const startGame = async () => {
  if (!canvas.value) return
  phase.value = 'loading'
  players.value = players.value.map((p) => ({ ...p, scores: [] }))
  holeIndex.value = 0
  currentPlayerIndex.value = 0
  strokesThisHole.value = Array(players.value.length).fill(0)

  await store.init(
    canvas.value,
    {},
    {
      defineSetup: ({ scene, camera, world, animate }) => {
        let ballState: BallState | null = null
        const aim = createAimState()
        const ctx: GameContext = {
          scene,
          camera,
          world,
          aim,
          getBall: () => ballState,
          setBall: (b) => {
            ballState = b
          }
        }

        buildHole(ctx)
        phase.value = 'game'

        const onPointerDown = (e: PointerEvent) => {
          if (waiting.value || !ballState || !isBallStopped(ballState)) return
          beginDrag(aim, e.clientX, e.clientY)
        }
        const onPointerMove = (e: PointerEvent) => {
          if (!aim.dragging) return
          updateDrag(aim, e.clientX, e.clientY, camera, ballState!.mesh.position)
        }
        const onPointerUp = (e: PointerEvent) => {
          if (!aim.dragging || !ballState) return
          updateDrag(aim, e.clientX, e.clientY, camera, ballState.mesh.position)
          if (!endDrag(aim) || strokesThisHole.value[currentPlayerIndex.value] >= MAX_STROKES)
            return
          strokesThisHole.value = strokesThisHole.value.map((s, i) =>
            i === currentPlayerIndex.value ? s + 1 : s
          )
          setOrbitEnabled(true)
          shootBall(ballState, aim.direction, aim.power, MAX_SHOT_POWER)
        }

        canvas.value!.addEventListener('pointerdown', onPointerDown)
        canvas.value!.addEventListener('pointermove', onPointerMove)
        canvas.value!.addEventListener('pointerup', onPointerUp)
        cleanupListeners = () => {
          canvas.value?.removeEventListener('pointerdown', onPointerDown)
          canvas.value?.removeEventListener('pointermove', onPointerMove)
          canvas.value?.removeEventListener('pointerup', onPointerUp)
        }

        animate({
          timeline: createTimelineManager(),
          beforeTimeline: () => {
            if (!ballState) return
            syncBall(ballState)
            const stopped = isBallStopped(ballState)
            setOrbitEnabled(!stopped || waiting.value)
            if (!waiting.value && stopped && strokesThisHole.value[currentPlayerIndex.value] > 0) {
              resolveTurn(ctx)
            }
          }
        })
      }
    }
  )
}

onUnmounted(() => {
  cleanupListeners?.()
  store.cleanup()
})
</script>

<template>
  <!-- Wizard -->
  <div v-if="phase === 'wizard'" class="mg-wizard">
    <div class="mg-wizard__card">
      <h1 class="mg-wizard__title">Minigolf</h1>

      <div class="mg-wizard__steps">
        <span class="mg-wizard__step" :class="{ 'mg-wizard__step--active': wizardStep === 1 }"
          >1. Players</span
        >
        <span class="mg-wizard__step-sep">›</span>
        <span class="mg-wizard__step" :class="{ 'mg-wizard__step--active': wizardStep === 2 }"
          >2. Course</span
        >
      </div>

      <div v-if="wizardStep === 1" class="mg-wizard__section">
        <div v-for="(player, index) in players" :key="index" class="mg-wizard__player">
          <input
            class="mg-wizard__input"
            :value="player.name"
            maxlength="20"
            @input="players[index] = { ...player, name: ($event.target as HTMLInputElement).value }"
          />
          <div class="mg-wizard__colors">
            <button
              v-for="color in PLAYER_COLORS"
              :key="color"
              class="mg-wizard__color"
              :class="{ 'mg-wizard__color--active': player.color === color }"
              :style="{ background: color }"
              :disabled="players.some((p, i) => i !== index && p.color === color)"
              @click="players[index] = { ...player, color }"
            />
          </div>
          <button v-if="players.length > 2" class="mg-wizard__remove" @click="removePlayer(index)">
            ✕
          </button>
        </div>
        <button v-if="players.length < 4" class="mg-wizard__add" @click="addPlayer">
          + Add player
        </button>
      </div>

      <div v-if="wizardStep === 2" class="mg-wizard__section">
        <label class="mg-wizard__label">
          Number of holes
          <select
            class="mg-wizard__select"
            :value="holeCount"
            @change="holeCount = Number(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="n in HOLES.length" :key="n" :value="n">{{ n }}</option>
          </select>
        </label>
      </div>

      <div class="mg-wizard__actions">
        <button
          v-if="wizardStep === 2"
          class="mg-wizard__btn mg-wizard__btn--secondary"
          @click="wizardStep = 1"
        >
          Back
        </button>
        <button
          v-if="wizardStep === 1"
          class="mg-wizard__btn mg-wizard__btn--primary"
          @click="wizardStep = 2"
        >
          Next
        </button>
        <button
          v-if="wizardStep === 2"
          class="mg-wizard__btn mg-wizard__btn--primary"
          @click="startGame"
        >
          Start
        </button>
      </div>
    </div>
  </div>

  <!-- Loading -->
  <div v-else-if="phase === 'loading'" class="mg-loading">Loading course…</div>

  <!-- Game -->
  <div v-else-if="phase === 'game'" class="mg-game">
    <canvas ref="canvas" />
    <div class="mg-game__hud">
      <div class="mg-game__player" :style="{ borderColor: currentPlayer.color }">
        {{ currentPlayer.name }}
      </div>
      <div class="mg-game__info">
        <span>Hole {{ holeIndex + 1 }}/{{ holes.length }} · Par {{ holes[holeIndex].par }}</span>
        <span>Stroke {{ strokesThisHole[currentPlayerIndex] }}/{{ MAX_STROKES }}</span>
      </div>
    </div>
    <div v-if="message" class="mg-game__message">{{ message }}</div>
    <div class="mg-game__hint">Drag to aim &amp; shoot</div>
  </div>

  <!-- Summary -->
  <div v-else class="mg-summary">
    <div class="mg-summary__card">
      <h2 class="mg-summary__title">Final Scores</h2>
      <table class="mg-summary__table">
        <thead>
          <tr>
            <th>Player</th>
            <th v-for="n in holeCount" :key="n">H{{ n }}</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="player in players" :key="player.name">
            <td>
              <span class="mg-summary__dot" :style="{ background: player.color }" />
              {{ player.name }}
            </td>
            <td v-for="(score, i) in player.scores" :key="i">{{ score }}</td>
            <td class="mg-summary__total">{{ totalScore(player) }}</td>
          </tr>
        </tbody>
      </table>
      <button class="mg-wizard__btn mg-wizard__btn--primary" @click="resetToWizard">
        Play again
      </button>
    </div>
  </div>
</template>

<style scoped>
.mg-wizard {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding-top: var(--nav-height);
  background: var(--color-background);
}

.mg-wizard__card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  padding: var(--spacing-6);
  background: var(--color-secondary);
  border-radius: var(--radius-lg);
  width: min(480px, 92vw);
}

.mg-wizard__title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-foreground);
  margin: 0;
  text-align: center;
}

.mg-wizard__steps {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  justify-content: center;
  font-size: var(--font-size-xs);
  color: var(--color-foreground);
  opacity: 0.5;
}

.mg-wizard__step--active {
  opacity: 1;
  font-weight: 600;
}

.mg-wizard__section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.mg-wizard__player {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.mg-wizard__input {
  flex: 1;
  padding: var(--spacing-1) var(--spacing-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-background);
  color: var(--color-foreground);
  font-size: var(--font-size-sm);
}

.mg-wizard__colors {
  display: flex;
  gap: var(--spacing-1);
}

.mg-wizard__color {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}

.mg-wizard__color--active {
  border-color: var(--color-foreground);
}

.mg-wizard__color:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.mg-wizard__remove {
  background: none;
  border: none;
  color: var(--color-foreground);
  opacity: 0.4;
  cursor: pointer;
  font-size: var(--font-size-sm);
  padding: var(--spacing-1);
}

.mg-wizard__add {
  background: none;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-foreground);
  opacity: 0.6;
  cursor: pointer;
  padding: var(--spacing-2);
  font-size: var(--font-size-sm);
}

.mg-wizard__label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
}

.mg-wizard__select {
  padding: var(--spacing-1) var(--spacing-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-background);
  color: var(--color-foreground);
  font-size: var(--font-size-sm);
}

.mg-wizard__actions {
  display: flex;
  gap: var(--spacing-2);
  justify-content: flex-end;
}

.mg-wizard__btn {
  padding: var(--spacing-2) var(--spacing-4);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  border: none;
}

.mg-wizard__btn--primary {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.mg-wizard__btn--secondary {
  background: var(--color-background);
  color: var(--color-foreground);
  border: 1px solid var(--color-border);
}

.mg-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  padding-top: var(--nav-height);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-foreground);
  background: var(--color-background);
}

.mg-game {
  position: relative;
  width: 100%;
  height: 100vh;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.mg-game__hud {
  position: absolute;
  top: calc(var(--nav-height) + var(--spacing-2));
  left: var(--spacing-3);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.mg-game__player {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-foreground);
  background: var(--color-background);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-sm);
  border-left: 3px solid;
  opacity: 0.95;
}

.mg-game__info {
  display: flex;
  gap: var(--spacing-3);
  font-size: var(--font-size-xs);
  color: var(--color-foreground);
  background: var(--color-background);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-sm);
  opacity: 0.9;
}

.mg-game__message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-foreground);
  background: var(--color-background);
  padding: var(--spacing-3) var(--spacing-4);
  border-radius: var(--radius-md);
  text-align: center;
  white-space: nowrap;
}

.mg-game__hint {
  position: absolute;
  bottom: var(--spacing-3);
  left: 50%;
  transform: translateX(-50%);
  font-size: var(--font-size-xs);
  color: var(--color-foreground);
  opacity: 0.5;
}

.mg-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding-top: var(--nav-height);
  background: var(--color-background);
}

.mg-summary__card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  padding: var(--spacing-6);
  background: var(--color-secondary);
  border-radius: var(--radius-lg);
  width: min(560px, 92vw);
  align-items: center;
}

.mg-summary__title {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-foreground);
  margin: 0;
}

.mg-summary__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
}

.mg-summary__table th,
.mg-summary__table td {
  padding: var(--spacing-1) var(--spacing-2);
  text-align: center;
  border-bottom: 1px solid var(--color-border);
}

.mg-summary__table td:first-child,
.mg-summary__table th:first-child {
  text-align: left;
}

.mg-summary__dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: var(--spacing-1);
}

.mg-summary__total {
  font-weight: 700;
}
</style>
