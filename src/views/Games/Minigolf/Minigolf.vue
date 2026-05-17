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
import {
  createBall,
  syncBall,
  shootBall,
  isBallStopped,
  resetBall,
  freezeBall,
  spawnConfetti,
  stepConfetti
} from './helpers/ball'
import type { ConfettiParticle } from './helpers/ball'
import { createAimState, beginDrag, updateDrag, endDrag } from './helpers/input'
import {
  HOLES,
  BALL_RADIUS,
  CAMERA_OFFSET_TOPDOWN,
  MAX_SHOT_POWER,
  MAX_STROKES,
  AIM_LINE_MAX_LENGTH,
  CONFETTI_LIFETIME,
  WALL_HEIGHT
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
import MinigolfHeader from './MinigolfHeader.vue'
import MultiplayerSidebar, { type MultiplayerPlayer } from '@/components/MultiplayerSidebar.vue'
import type { BallState } from './helpers/ball'

const route = useRoute()
const router = useRouter()
const canvas = ref<HTMLCanvasElement | null>(null)
const sceneStore = useSceneViewStore()
const { orbitReference } = storeToRefs(sceneStore)
const store = useMinigolfStore()
const {
  phase,
  playerList,
  holeCount,
  selectedHoles,
  currentHole,
  messages,
  hostId,
  remoteBallPositions
} = storeToRefs(store)

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

const activeHoles = computed(() =>
  selectedHoles.value.length > 0
    ? selectedHoles.value.map((i) => HOLES[i]).filter(Boolean)
    : HOLES.slice(0, holeCount.value)
)

const localStrokes = ref(0)
const message = ref('')
const waiting = ref(false)
const aimPower = ref(0)
const isAiming = ref(false)
const sidebarPlayers = computed((): MultiplayerPlayer[] =>
  playerList.value.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    score: p.scores?.reduce((a, b) => a + b, 0) ?? 0,
    isHost: p.id === hostId.value
  }))
)

const allPlayersScored = computed(() => {
  const holeIndex = currentHole.value
  return (
    playerList.value.length > 0 && playerList.value.every((p) => (p.scores[holeIndex] ?? 0) > 0)
  )
})

let cleanupListeners: (() => void) | null = null

interface GameContext {
  scene: THREE.Scene
  camera: THREE.Camera
  world: import('@dimforge/rapier3d-compat').default.World
  getBall: () => BallState | null
  setBall: (b: BallState) => void
  aim: ReturnType<typeof createAimState>
  holeBodies: import('@dimforge/rapier3d-compat').default.RigidBody[]
  confetti: ConfettiParticle[]
}

const safeRemoveBody = (
  body: import('@dimforge/rapier3d-compat').default.RigidBody,
  world: GameContext['world']
): void => {
  try {
    world.removeRigidBody(body)
  } catch {
    // already removed
  }
}

const clearHoleObjects = (ctx: GameContext): void => {
  const toRemove = ctx.scene.children.filter((c) => c.userData.mgHole)
  toRemove.forEach((c) => ctx.scene.remove(c))
  ctx.holeBodies.forEach((body) => safeRemoveBody(body, ctx.world))
  ctx.holeBodies.length = 0
  ctx.confetti.length = 0
  const ball = ctx.getBall()
  if (ball) safeRemoveBody(ball.body, ctx.world)
}

const tagHoleObject = (object: THREE.Object3D): void => {
  object.userData.mgHole = true
}

const AIM_DASH_COUNT = 8
const AIM_DASH_RADIUS = 0.09

const createAimDots = (scene: THREE.Scene): THREE.Mesh[] => {
  const geo = new THREE.SphereGeometry(AIM_DASH_RADIUS, 8, 8)
  const mat = new THREE.MeshToonMaterial({ color: 0xffffff })
  return Array.from({ length: AIM_DASH_COUNT }, () => {
    const mesh = new THREE.Mesh(geo, mat)
    mesh.castShadow = true
    mesh.visible = false
    scene.add(mesh)
    return mesh
  })
}

const updateAimDots = (
  dots: THREE.Mesh[],
  ball: BallState,
  direction: THREE.Vector3,
  power: number
): void => {
  const length = power * AIM_LINE_MAX_LENGTH
  const step = length / (AIM_DASH_COUNT + 1)
  const origin = ball.mesh.position
  dots.forEach((dot, i) => {
    const t = step * (i + 1)
    dot.position.set(
      origin.x + direction.x * t,
      origin.y + AIM_DASH_RADIUS,
      origin.z + direction.z * t
    )
  })
}

const buildHole = (ctx: GameContext): void => {
  clearHoleObjects(ctx)
  const hole = activeHoles.value[currentHole.value]
  const midX = (hole.teePosition[0] + hole.holePosition[0]) / 2
  const midZ = (hole.teePosition[2] + hole.holePosition[2]) / 2
  ctx.camera.position.set(
    midX + CAMERA_OFFSET_TOPDOWN[0],
    CAMERA_OFFSET_TOPDOWN[1],
    midZ + CAMERA_OFFSET_TOPDOWN[2]
  )
  ctx.camera.up.set(0, 0, -1)
  ctx.camera.lookAt(midX, 0, midZ)
  const { meshes: groundMeshes, bodies: groundBodies } = buildGround(hole, ctx.scene, ctx.world)
  groundMeshes.forEach(tagHoleObject)
  groundBodies.forEach((b) => ctx.holeBodies.push(b))
  const { meshes: wallMeshes, bodies: wallBodies } = buildWalls(hole, ctx.scene, ctx.world)
  wallMeshes.forEach(tagHoleObject)
  wallBodies.forEach((b) => ctx.holeBodies.push(b))
  tagHoleObject(buildHoleMarker(hole.holePosition, ctx.scene))
  const ball = createBall(hole.teePosition, ctx.scene, ctx.world)
  tagHoleObject(ball.mesh)
  ctx.setBall(ball)
  ctx.aim.direction.set(0, 0, -1)
  message.value = ''
  waiting.value = false
  localStrokes.value = 0
}

const advanceHole = (): void => {
  const nextHole = currentHole.value + 1
  if (nextHole >= activeHoles.value.length) {
    store.phase = 'summary'
    session.broadcastAdvanceHole(-1)
    return
  }
  store.currentHole = nextHole // triggers local watch
  session.broadcastAdvanceHole(nextHole) // triggers remote watch
}

const resolveTurn = (_ctx: GameContext, holed = false): void => {
  const finalStrokes = holed ? localStrokes.value : MAX_STROKES
  waiting.value = true
  const par = activeHoles.value[currentHole.value].par
  message.value = holed
    ? `${finalStrokes} stroke${finalStrokes !== 1 ? 's' : ''}! Par ${par}`
    : 'Max strokes — waiting…'
  session.broadcastScore(currentHole.value, finalStrokes)
}

let gameContext: GameContext | null = null

const checkHoleEntry = (ballState: BallState, ctx: GameContext): void => {
  if (ballState.mesh.position.y < -BALL_RADIUS) {
    freezeBall(ballState)
    const hp = activeHoles.value[currentHole.value].holePosition
    ctx.confetti = spawnConfetti(ctx.scene, hp[0], hp[2])
    resolveTurn(ctx, true)
    return
  }
  if (isBallStopped(ballState) && localStrokes.value >= MAX_STROKES) {
    resolveTurn(ctx)
  }
}

const runFrame = (ballState: BallState, ctx: GameContext): void => {
  ctx.confetti = stepConfetti(ctx.confetti, ctx.scene, CONFETTI_LIFETIME)

  syncBall(ballState)

  const vel = ballState.body.linvel()
  const speed = Math.hypot(vel.x, vel.y, vel.z)
  if (speed > 0.01 && speed < 1.5) {
    ballState.body.setLinvel({ x: vel.x * 0.88, y: vel.y, z: vel.z * 0.88 }, false)
  }

  const py = ballState.mesh.position.y
  if (py > WALL_HEIGHT + 1) {
    resetBall(ballState, activeHoles.value[currentHole.value].teePosition)
    return
  }

  if (!waiting.value && localStrokes.value > 0) checkHoleEntry(ballState, ctx)
}

const setupGameScene = ({
  scene,
  camera,
  world,
  animate
}: Parameters<
  Parameters<typeof sceneStore.init>[2]['defineSetup'] extends (a: infer A) => void
    ? (a: A) => void
    : never
>[0]): void => {
  let ballState: BallState | null = null
  const aim = createAimState()
  const ctx: GameContext = {
    scene,
    camera,
    world,
    aim,
    holeBodies: [],
    confetti: [],
    getBall: () => ballState,
    setBall: (b) => {
      ballState = b
    }
  }

  gameContext = ctx
  buildHole(ctx)
  const aimDots = createAimDots(scene)

  const ghostGeo = new THREE.SphereGeometry(BALL_RADIUS, 12, 12)
  const ghostMeshes: Record<string, THREE.Mesh> = {}

  const syncGhostBalls = (): void => {
    const positions = remoteBallPositions.value
    Object.keys(positions).forEach((peerId) => {
      if (peerId === localPeerId.value) return
      const player = store.players[peerId]
      if (!player) return
      const pos = positions[peerId]
      if (!ghostMeshes[peerId]) {
        const mat = new THREE.MeshToonMaterial({
          color: new THREE.Color(player.color),
          transparent: true,
          opacity: 0.45
        })
        const mesh = new THREE.Mesh(ghostGeo, mat)
        scene.add(mesh)
        ghostMeshes[peerId] = mesh
      }
      ghostMeshes[peerId].position.set(pos.x, pos.y, pos.z)
    })
  }

  const onPointerDown = (e: PointerEvent): void => {
    if (waiting.value || !ballState || !isBallStopped(ballState) || orbitReference.value?.enabled)
      return
    beginDrag(aim, e.clientX, e.clientY)
    isAiming.value = true
    aimDots.forEach((d) => {
      d.visible = true
    })
  }
  const onPointerMove = (e: PointerEvent): void => {
    if (!aim.dragging || !ballState) return
    updateDrag(aim, e.clientX, e.clientY, camera, ballState.mesh.position)
    aimPower.value = Math.round(aim.power * 100)
    updateAimDots(aimDots, ballState, aim.direction, aim.power)
  }
  const onPointerUp = (e: PointerEvent): void => {
    if (!aim.dragging || !ballState) return
    updateDrag(aim, e.clientX, e.clientY, camera, ballState.mesh.position)
    aimDots.forEach((d) => {
      d.visible = false
    })
    isAiming.value = false
    aimPower.value = 0
    if (!endDrag(aim) || localStrokes.value >= MAX_STROKES) return
    localStrokes.value++
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
      syncGhostBalls()
      if (!ballState) return
      const pos = ballState.mesh.position
      session.broadcastBallPosition(pos.x, pos.y, pos.z)
      runFrame(ballState, ctx)
    }
  })
}

const SCENE_LIGHTS = {
  directional: {
    shadow: {
      mapSize: { width: 2048, height: 2048 },
      bias: -0.001,
      radius: 1,
      camera: { left: -20, right: 20, top: 20, bottom: -20, near: 0.5, far: 50 }
    }
  }
}

const startGame = async (): Promise<void> => {
  if (!canvas.value) return
  playerList.value
    .map((p) => ({ ...p, scores: [] as number[] }))
    .forEach((p) => store.upsertPlayer(p))
  store.currentHole = 0
  localStrokes.value = 0
  await sceneStore.init(
    canvas.value,
    { ground: false, sky: false, orbit: { disabled: true }, lights: SCENE_LIGHTS },
    { playMode: true, viewPanels: { showElements: false }, defineSetup: setupGameScene }
  )
}

watch(phase, async (newPhase) => {
  if (newPhase === 'playing') {
    await nextTick()
    startGame()
  }
})

watch(currentHole, (next, previous) => {
  if (next === previous || !gameContext || phase.value !== 'playing') return
  localStrokes.value = 0
  message.value = ''
  waiting.value = false
  buildHole(gameContext)
})

watch(allPlayersScored, (allDone) => {
  if (!allDone || !isHost.value || phase.value !== 'playing') return
  setTimeout(() => advanceHole(), 1500)
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

const handleSelectedHolesChange = (indices: number[]): void => {
  session.broadcastConfig(indices.length, indices)
}

const handleStartGame = (): void => {
  session.broadcastStart()
}

const handlePlayAgain = (): void => {
  store.phase = 'lobby'
  store.currentHole = 0
  localStrokes.value = 0
  waiting.value = false
  const resetPlayers = playerList.value.map((p) => ({ ...p, scores: [] }))
  resetPlayers.forEach((p) => store.upsertPlayer(p))
  cleanupListeners?.()
  sceneStore.cleanup()
  gameContext = null
}

const copyLink = async (): Promise<void> => {
  const url = new URL(window.location.href)
  url.searchParams.set('room', roomId.value)
  await navigator.clipboard.writeText(url.toString())
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
    <MinigolfHeader :room-id="roomId" @copy-link="copyLink" />

    <MinigolfLobby
      v-if="phase === 'lobby'"
      class="mg__main"
      :player-name="playerName"
      :player-color="playerColor"
      :is-host="isHost"
      :player-list="playerList"
      :room-id="roomId"
      :hole-count="holeCount"
      :selected-holes="selectedHoles"
      @update:player-name="playerName = $event"
      @update:player-color="handleColorChange"
      @update:selected-holes="handleSelectedHolesChange"
      @name-change="handleNameChange"
      @start-game="handleStartGame"
      @match-found="handleMatchFound"
      @leave-room="handleLeaveRoom"
    />

    <div v-else-if="phase === 'playing'" class="mg__main mg-game">
      <div class="mg-game__bar">
        <div class="mg-game__center">
          <span v-if="message" class="mg-game__message">{{ message }}</span>
          <span v-else-if="waiting" class="mg-game__hint">Waiting for others…</span>
          <span v-else-if="!isAiming" class="mg-game__hint">Drag to aim &amp; shoot</span>
          <div v-else class="mg-game__power-bar">
            <div class="mg-game__power-fill" :style="{ width: `${aimPower}%` }" />
          </div>
        </div>
        <div class="mg-game__info">
          <span>Hole {{ currentHole + 1 }}/{{ activeHoles.length }}</span>
          <span>Par {{ activeHoles[currentHole].par }}</span>
          <span>Stroke {{ localStrokes }}/{{ MAX_STROKES }}</span>
        </div>
      </div>
      <div class="mg-game__canvas">
        <canvas ref="canvas" />
      </div>
    </div>

    <div v-else class="mg__main mg-summary">
      <div class="mg-summary__card">
        <h2 class="mg-summary__title">Final Scores</h2>
        <table class="mg-summary__table">
          <thead>
            <tr>
              <th>Player</th>
              <th v-for="(_, n) in activeHoles" :key="n">H{{ n + 1 }}</th>
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

    <MultiplayerSidebar
      class="mg__sidebar"
      :players="sidebarPlayers"
      :local-peer-id="localPeerId"
      :messages="messages"
      chat-placeholder="Say something…"
      @send="session.broadcastChat($event)"
    />
  </main>
</template>

<style scoped>
.mg {
  --mg-green: #4caf50;
  --mg-yellow: #ffd93d;

  touch-action: manipulation;
  display: grid;
  grid-template-columns: 1fr 280px;
  grid-template-areas: 'header header' 'main sidebar';
  grid-template-rows: auto minmax(0, 1fr);
  height: 100dvh;
  box-sizing: border-box;
  overflow: hidden;
  padding: var(--spacing-3);
  padding-top: calc(var(--nav-height) + var(--spacing-3));
  gap: var(--spacing-3);
  font-family: 'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', cursive, system-ui;
  background: var(--mg-bg);
}

.mg--lobby {
  height: auto;
  min-height: 100dvh;
  overflow: auto;
}

.mg :deep(.mg-header) {
  animation: slide-from-right 0.32s ease both;
}

.mg__main {
  grid-area: main;
  min-height: 0;
  animation: slide-up 0.28s ease both;
}

.mg__sidebar {
  grid-area: sidebar;
  animation: slide-from-right 0.32s ease both;
}

.mg-game {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 1.25rem;
  border: 3px solid var(--game-border);
  box-shadow: 4px 4px 0 var(--game-border);
}

.mg-game__bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3);
  border-bottom: 2px solid var(--game-border);
  background: var(--game-surface-subtle);
  flex-shrink: 0;
  min-height: 2.5rem;
}

.mg-game__center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
  gap: var(--spacing-2);
}

.mg-game__message {
  font-size: var(--font-size-sm);
  font-weight: 900;
  color: #fff;
  white-space: nowrap;
  animation: slide-up 0.15s ease both;
}

.mg-game__hint {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
}

.mg-game__power-bar {
  width: 160px;
  height: 14px;
  background: rgba(255, 255, 255, 0.25);
  border: 2px solid #fff;
  overflow: hidden;
}

.mg-game__power-fill {
  height: 100%;
  background: #fff;
  transition: width 0.05s ease-out;
}

.mg-game__info {
  display: flex;
  gap: var(--spacing-2);
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  flex-shrink: 0;
  margin-left: auto;
}

.mg-game__canvas {
  flex: 1;
  min-height: 0;
  position: relative;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.mg-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
}

.mg-summary__card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  padding: var(--spacing-6);
  background: var(--game-surface-subtle);
  border: 3px solid var(--game-border);
  border-radius: 1.25rem;
  box-shadow: 4px 4px 0 var(--game-border);
  width: min(560px, 92%);
  align-items: center;
}

.mg-summary__title {
  font-size: var(--font-size-xl);
  font-weight: 900;
  color: var(--game-ink);
  margin: 0;
}

.mg-summary__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
  color: var(--game-ink);
}

.mg-summary__table th,
.mg-summary__table td {
  padding: var(--spacing-1) var(--spacing-2);
  text-align: center;
  border-bottom: 2px solid var(--game-border);
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
  padding: var(--spacing-2) var(--spacing-5);
  border: 3px solid var(--game-border);
  border-radius: 999px;
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 3px 3px 0 var(--game-border);
  transition: transform 0.1s ease;
  font-family: inherit;
}

.mg-summary__btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--game-border);
}

.mg-summary__btn--primary {
  background: var(--mg-yellow);
  color: var(--game-ink);
}

.mg-summary__hint {
  font-size: var(--font-size-sm);
  color: var(--game-ink-muted);
  margin: 0;
}

@media (max-width: 720px) {
  .mg {
    grid-template-columns: 1fr;
    grid-template-areas: 'header' 'main' 'sidebar';
    grid-template-rows: auto minmax(0, 1fr) auto;
    height: auto;
    min-height: 100dvh;
    padding: 0 var(--spacing-2);
    padding-top: var(--nav-height);
    padding-bottom: var(--spacing-2);
    gap: var(--spacing-2);
    overflow: auto;
  }

  .mg--lobby {
    overflow: auto;
  }
}
</style>
