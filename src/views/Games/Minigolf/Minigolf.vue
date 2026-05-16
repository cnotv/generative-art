<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import * as THREE from 'three'
import { createTimelineManager } from '@webgamekit/animation'
import { useSceneViewStore } from '@/stores/sceneView'
import { useMinigolfStore } from '@/stores/minigolf'
import { useMinigolfSession } from './useMinigolfSession'
import { buildGround, buildWalls, buildHoleMarker } from './helpers/course'
import { createBall, syncBall, shootBall, isBallStopped, resetBall } from './helpers/ball'
import { createAimState, beginDrag, updateDrag, endDrag } from './helpers/input'
import {
  HOLES,
  CAMERA_OFFSET_TOPDOWN,
  MAX_SHOT_POWER,
  WIN_DISTANCE,
  MAX_STROKES,
  AIM_LINE_COLOR,
  AIM_LINE_MAX_LENGTH
} from './config'
import {
  loadProfile,
  saveProfile,
  randomPick,
  NAME_ADJECTIVES,
  NAME_ANIMALS,
  PLAYER_COLORS,
  buildRandomGradient
} from '@/utils/playerProfile'
import MinigolfLobby from './MinigolfLobby.vue'
import type { BallState } from './helpers/ball'

const route = useRoute()
const router = useRouter()
const canvas = ref<HTMLCanvasElement | null>(null)
const sceneStore = useSceneViewStore()
const store = useMinigolfStore()
const { phase, playerList, holeCount, currentHole, hostId } = storeToRefs(store)

const storedProfile = loadProfile()
const playerName = ref(
  storedProfile?.name ?? `${randomPick(NAME_ADJECTIVES)}${randomPick(NAME_ANIMALS)}`
)
const playerColor = ref(storedProfile?.color ?? randomPick(PLAYER_COLORS))
const backgroundStyle = { backgroundImage: buildRandomGradient() }

const resolvedRoomId = ((): string => {
  const existing = route.query.room as string | undefined
  if (existing) return existing
  const next = crypto.randomUUID()
  router.replace({ query: { ...route.query, room: next } })
  return next
})()

const roomId = ref(resolvedRoomId)

const session = useMinigolfSession({
  name: playerName.value,
  color: playerColor.value,
  roomId: resolvedRoomId
})

const { isHost, localPeerId } = session

const holes = computed(() => HOLES.slice(0, holeCount.value))

const currentPlayerIndex = ref(0)
const strokesThisHole = ref<number[]>([])
const message = ref('')
const waiting = ref(false)
const aimPower = ref(0)
const isAiming = ref(false)

const currentPlayer = computed(() => playerList.value[currentPlayerIndex.value])

let cleanupListeners: (() => void) | null = null

interface GameContext {
  scene: THREE.Scene
  camera: THREE.Camera
  world: import('@dimforge/rapier3d-compat').default.World
  getBall: () => BallState | null
  setBall: (b: BallState) => void
  aim: ReturnType<typeof createAimState>
}

const clearHoleObjects = (scene: THREE.Scene): void => {
  const toRemove = scene.children.filter((c) => c.userData.mgHole)
  toRemove.forEach((c) => scene.remove(c))
}

const tagHoleObject = (object: THREE.Object3D): void => {
  object.userData.mgHole = true
}

const createAimLine = (scene: THREE.Scene): THREE.Line => {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1)
  ])
  const material = new THREE.LineBasicMaterial({ color: AIM_LINE_COLOR })
  const line = new THREE.Line(geometry, material)
  line.visible = false
  scene.add(line)
  return line
}

const updateAimLine = (
  line: THREE.Line,
  ball: BallState,
  direction: THREE.Vector3,
  power: number
): void => {
  const length = power * AIM_LINE_MAX_LENGTH
  const end = ball.mesh.position.clone().addScaledVector(direction, length)
  const positions = new Float32Array([
    ball.mesh.position.x,
    ball.mesh.position.y,
    ball.mesh.position.z,
    end.x,
    end.y,
    end.z
  ])
  line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  line.geometry.attributes.position.needsUpdate = true
}

const buildHole = (ctx: GameContext): void => {
  clearHoleObjects(ctx.scene)
  const hole = holes.value[currentHole.value]
  ctx.camera.position.set(
    hole.teePosition[0] + CAMERA_OFFSET_TOPDOWN[0],
    hole.teePosition[1] + CAMERA_OFFSET_TOPDOWN[1],
    hole.teePosition[2] + CAMERA_OFFSET_TOPDOWN[2]
  )
  ctx.camera.lookAt(hole.teePosition[0], 0, hole.teePosition[2])
  tagHoleObject(buildGround(hole, ctx.scene, ctx.world))
  buildWalls(hole, ctx.scene, ctx.world).forEach(tagHoleObject)
  tagHoleObject(buildHoleMarker(hole.holePosition, ctx.scene))
  const ball = createBall(hole.teePosition, ctx.scene, ctx.world)
  tagHoleObject(ball.mesh)
  ctx.setBall(ball)
  ctx.aim.direction.set(0, 0, -1)
  message.value = ''
  waiting.value = false
}

const advancePlayer = (ctx: GameContext): void => {
  currentPlayerIndex.value = (currentPlayerIndex.value + 1) % playerList.value.length
  const ball = ctx.getBall()
  if (ball) resetBall(ball, holes.value[currentHole.value].teePosition)
  message.value = ''
  waiting.value = false
}

const advanceHole = (ctx: GameContext): void => {
  const nextHole = currentHole.value + 1
  if (nextHole >= holes.value.length) {
    store.phase = 'summary'
    return
  }
  store.currentHole = nextHole
  currentPlayerIndex.value = 0
  strokesThisHole.value = Array(playerList.value.length).fill(0)
  buildHole(ctx)
}

const resolveTurn = (ctx: GameContext): void => {
  const ball = ctx.getBall()
  if (!ball) return
  const strokes = strokesThisHole.value[currentPlayerIndex.value]
  const holePosition = new THREE.Vector3(...holes.value[currentHole.value].holePosition)
  const isHoled = ball.mesh.position.distanceTo(holePosition) < WIN_DISTANCE
  const isMaxed = strokes >= MAX_STROKES
  if (!isHoled && !isMaxed) return

  waiting.value = true
  const par = holes.value[currentHole.value].par
  const finalStrokes = isHoled ? strokes : MAX_STROKES
  const player = currentPlayer.value
  if (player) {
    session.broadcastScore(currentHole.value, finalStrokes)
    message.value = isHoled
      ? `${player.name}: ${strokes} stroke${strokes !== 1 ? 's' : ''}! Par ${par}`
      : `${player.name}: max strokes`
  }

  const isLastPlayer = currentPlayerIndex.value === playerList.value.length - 1
  setTimeout(() => {
    if (isLastPlayer) advanceHole(ctx)
    else advancePlayer(ctx)
  }, 1800)
}

let gameContext: GameContext | null = null

const startGame = async (): Promise<void> => {
  if (!canvas.value) return

  const resetScores = playerList.value.map((p) => ({ ...p, scores: [] }))
  resetScores.forEach((p) => store.upsertPlayer(p))

  store.currentHole = 0
  currentPlayerIndex.value = 0
  strokesThisHole.value = Array(playerList.value.length).fill(0)

  await sceneStore.init(
    canvas.value,
    { ground: false, sky: false, orbit: false },
    {
      playMode: true,
      viewPanels: { showElements: false, showConfig: false },
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

        gameContext = ctx
        buildHole(ctx)
        const aimLine = createAimLine(scene)

        const onPointerDown = (e: PointerEvent): void => {
          if (waiting.value || !ballState || !isBallStopped(ballState)) return
          beginDrag(aim, e.clientX, e.clientY)
          isAiming.value = true
          aimLine.visible = true
        }
        const onPointerMove = (e: PointerEvent): void => {
          if (!aim.dragging || !ballState) return
          updateDrag(aim, e.clientX, e.clientY, camera, ballState.mesh.position)
          aimPower.value = Math.round(aim.power * 100)
          updateAimLine(aimLine, ballState, aim.direction, aim.power)
        }
        const onPointerUp = (e: PointerEvent): void => {
          if (!aim.dragging || !ballState) return
          updateDrag(aim, e.clientX, e.clientY, camera, ballState.mesh.position)
          aimLine.visible = false
          isAiming.value = false
          aimPower.value = 0
          if (!endDrag(aim) || strokesThisHole.value[currentPlayerIndex.value] >= MAX_STROKES)
            return
          strokesThisHole.value = strokesThisHole.value.map((s, i) =>
            i === currentPlayerIndex.value ? s + 1 : s
          )
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
            if (!waiting.value && stopped && strokesThisHole.value[currentPlayerIndex.value] > 0) {
              resolveTurn(ctx)
            }
          }
        })
      }
    }
  )
}

watch(phase, async (newPhase) => {
  if (newPhase === 'playing') {
    await nextTick()
    startGame()
  }
})

const handleMatchFound = (gameRoomId: string): void => {
  roomId.value = gameRoomId
  router.replace({ query: { room: gameRoomId } })
  session.reconnect(gameRoomId)
}

const handleLeaveRoom = (): void => {
  const freshId = crypto.randomUUID()
  roomId.value = freshId
  router.replace({ query: { room: freshId } })
  session.reconnect(freshId)
}

const handleNameChange = (): void => {
  const trimmed = playerName.value.trim()
  if (!trimmed) return
  session.updateProfile(trimmed, playerColor.value)
  saveProfile(trimmed, playerColor.value)
}

const handleColorChange = (color: string): void => {
  playerColor.value = color
  session.updateProfile(playerName.value.trim() || playerName.value, color)
  saveProfile(playerName.value.trim() || playerName.value, color)
}

const handleConfigChange = (holeCountValue: number): void => {
  session.broadcastConfig(holeCountValue)
}

const handleStartGame = (): void => {
  session.broadcastStart()
}

const handlePlayAgain = (): void => {
  store.phase = 'lobby'
  store.currentHole = 0
  const resetPlayers = playerList.value.map((p) => ({ ...p, scores: [] }))
  resetPlayers.forEach((p) => store.upsertPlayer(p))
  cleanupListeners?.()
  sceneStore.cleanup()
  gameContext = null
}

const totalScore = (scores: number[]): number => scores.reduce((a, b) => a + b, 0)

onMounted(() => {
  session.init()
})

onUnmounted(() => {
  cleanupListeners?.()
  sceneStore.cleanup()
})
</script>

<template>
  <main class="mg" :class="`mg--${phase}`" :style="backgroundStyle">
    <MinigolfLobby
      v-if="phase === 'lobby'"
      :player-name="playerName"
      :player-color="playerColor"
      :is-host="isHost"
      :player-list="playerList"
      :room-id="roomId"
      :hole-count="holeCount"
      @update:player-name="playerName = $event"
      @update:player-color="handleColorChange"
      @update:hole-count="handleConfigChange"
      @name-change="handleNameChange"
      @start-game="handleStartGame"
      @match-found="handleMatchFound"
      @leave-room="handleLeaveRoom"
    />

    <div v-else-if="phase === 'playing'" class="mg-game">
      <canvas ref="canvas" />
      <div class="mg-game__hud">
        <div
          v-if="currentPlayer"
          class="mg-game__player"
          :style="{ borderColor: currentPlayer.color }"
        >
          {{ currentPlayer.name }}
        </div>
        <div class="mg-game__info">
          <span
            >Hole {{ currentHole + 1 }}/{{ holes.length }} · Par {{ holes[currentHole].par }}</span
          >
          <span>Stroke {{ strokesThisHole[currentPlayerIndex] }}/{{ MAX_STROKES }}</span>
        </div>
      </div>
      <div v-if="isAiming" class="mg-game__power-bar">
        <div class="mg-game__power-fill" :style="{ width: `${aimPower}%` }" />
      </div>
      <div v-if="message" class="mg-game__message">{{ message }}</div>
      <div v-if="!isAiming" class="mg-game__hint">Drag to aim &amp; shoot</div>
    </div>

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
            <tr v-for="player in playerList" :key="player.id">
              <td>
                <span class="mg-summary__dot" :style="{ background: player.color }" />
                {{ player.name }}
              </td>
              <td v-for="(score, i) in player.scores" :key="i">{{ score }}</td>
              <td class="mg-summary__total">{{ totalScore(player.scores) }}</td>
            </tr>
          </tbody>
        </table>
        <button
          v-if="isHost"
          class="mg-summary__btn mg-summary__btn--primary"
          @click="handlePlayAgain"
        >
          Play again
        </button>
        <p v-else class="mg-summary__hint">Waiting for host to restart…</p>
      </div>
    </div>
  </main>
</template>

<style scoped>
.mg {
  --mg-green: #4caf50;

  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--color-background);
}

.mg--lobby {
  align-items: center;
  justify-content: center;
  padding-top: var(--nav-height);
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

.mg-game__power-bar {
  position: absolute;
  bottom: var(--spacing-4);
  left: 50%;
  transform: translateX(-50%);
  width: 180px;
  height: 14px;
  background: var(--color-secondary);
  border-radius: var(--radius-sm);
  overflow: hidden;
  display: flex;
  align-items: center;
}

.mg-game__power-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-sm);
  transition: width 0.05s ease-out;
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

.mg-summary__btn {
  padding: var(--spacing-2) var(--spacing-4);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  border: none;
}

.mg-summary__btn--primary {
  background: var(--color-primary);
  color: var(--color-primary-foreground);
}

.mg-summary__hint {
  font-size: var(--font-size-sm);
  color: var(--color-foreground);
  opacity: 0.6;
  margin: 0;
}
</style>
