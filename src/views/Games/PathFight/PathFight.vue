<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import * as THREE from 'three'
import { getCube } from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'
import { logicAdvanceAlongPath, type PathFollowState, type Waypoint } from '@webgamekit/logic'
import { useSceneViewStore } from '@/stores/sceneView'
import { usePathFightStore } from '@/stores/pathFight'
import { usePathFightSession } from './usePathFightSession'
import {
  drawCreatePathVisualization,
  drawRemovePathVisualization,
  drawInterpolateWaypoints
} from '@/views/Experiments/DrawPath/helpers/drawPath'
import {
  loadProfile,
  saveProfile,
  randomPick,
  NAME_ADJECTIVES,
  NAME_ANIMALS,
  PLAYER_COLORS,
  buildRandomGradient
} from '@/utils/playerProfile'
import MultiplayerSidebar, { type MultiplayerPlayer } from '@/components/MultiplayerSidebar.vue'
import GameTabBar from '@/components/GameTabBar.vue'
import PathFightLobby from './PathFightLobby.vue'
import {
  STAGE_WIDTH,
  STAGE_DEPTH,
  STAGE_HALF_W,
  STAGE_HALF_D,
  EXIT_Z_NEAR,
  EXIT_Z_FAR,
  EXIT_X,
  GOOMBA_GROUND_Y,
  GOOMBA_POSITIONS_P1,
  GOOMBA_POSITIONS_P2,
  ITEM_COUNT,
  ITEM_SIZE,
  ITEM_GROUND_Y,
  GOOMBA_PUSH_RANGE,
  GOOMBA_PUSH_IMPULSE,
  GOOMBA_FOLLOW_SPEED,
  MIN_WAYPOINT_DISTANCE,
  GOOMBA_COLOR_LOCAL,
  GOOMBA_COLOR_REMOTE,
  ITEM_COLOR,
  PATH_COLOR_LOCAL,
  PATH_COLOR_REMOTE,
  SELECTED_GOOMBA_COLOR,
  STAGE_EDGE_COLOR,
  sceneSetupConfig
} from './config'
import { GOOMBA_COUNT, PLANNING_DURATION_S, BATTLE_DURATION_S } from './constants'

// ─── router / profile ───────────────────────────────────────────────────────

const route = useRoute()
const router = useRouter()
const store = usePathFightStore()
const sceneStore = useSceneViewStore()
const { phase, playerList, messages, hostId } = storeToRefs(store)

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

// ─── session ─────────────────────────────────────────────────────────────────

const session = usePathFightSession({
  name: playerName.value,
  color: playerColor.value,
  roomId: resolvedRoomId
})
const { isHost, localPeerId } = session

// ─── sidebar / tab bar ───────────────────────────────────────────────────────

const showSidebar = ref(false)
const lastReadCount = ref(0)
const unreadCount = computed(() => Math.max(0, messages.value.length - lastReadCount.value))
watch(showSidebar, (open) => {
  if (open) lastReadCount.value = messages.value.length
})
watch(messages, () => {
  if (showSidebar.value) lastReadCount.value = messages.value.length
})

const sidebarPlayers = computed((): MultiplayerPlayer[] =>
  playerList.value.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    score: p.score,
    isHost: p.id === hostId.value
  }))
)

// ─── canvas ──────────────────────────────────────────────────────────────────

const canvas = ref<HTMLCanvasElement | null>(null)

// ─── game reactive state ─────────────────────────────────────────────────────

const selectedGoomba = ref(0)
const timerSeconds = ref(0)
const localScore = ref(0)
const gameMessage = ref('')

// ─── Three.js scene state ────────────────────────────────────────────────────

type GoombaObject = {
  mesh: THREE.Mesh
  pathLine: THREE.Group | null
  waypoints: Waypoint[]
  followState: PathFollowState | null
}

type ItemObject = {
  mesh: THREE.Mesh
  body: import('@dimforge/rapier3d-compat').default.RigidBody
}

type SceneReference = {
  scene: THREE.Scene
  camera: THREE.Camera
  world: import('@dimforge/rapier3d-compat').default.World
  localGoombas: GoombaObject[]
  remoteGoombas: GoombaObject[]
  items: ItemObject[]
  edgeMeshes: THREE.Mesh[]
}

let sceneReference: SceneReference | null = null
let timerInterval: ReturnType<typeof setInterval> | null = null
let battleTimeout: ReturnType<typeof setTimeout> | null = null

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

// ─── helpers: coordinate conversion ──────────────────────────────────────────

const getNdc = (
  event: MouseEvent | TouchEvent,
  canvasElement: HTMLCanvasElement
): THREE.Vector2 => {
  const rect = canvasElement.getBoundingClientRect()
  const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX
  const clientY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY
  return new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1
  )
}

const raycastGround = (ndc: THREE.Vector2, camera: THREE.Camera): THREE.Vector3 | null => {
  if (!('fov' in camera)) return null
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(ndc, camera as THREE.PerspectiveCamera)
  const target = new THREE.Vector3()
  return raycaster.ray.intersectPlane(groundPlane, target) ? target : null
}

// ─── helpers: goomba mesh creation ───────────────────────────────────────────

const makeGoomba = (
  scene: THREE.Scene,
  position: [number, number, number],
  color: number
): THREE.Mesh => {
  const geo = new THREE.BoxGeometry(0.9, 0.9, 0.9)
  const mat = new THREE.MeshToonMaterial({ color })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)
  return mesh
}

// ─── helpers: stage edge markers ─────────────────────────────────────────────

const buildStageEdges = (scene: THREE.Scene): THREE.Mesh[] => {
  const mat = new THREE.MeshBasicMaterial({
    color: STAGE_EDGE_COLOR,
    transparent: true,
    opacity: 0.4
  })
  const edgeH = 0.15
  const edgeThick = 0.3
  const configs: [number, number, number, number, number, number][] = [
    // [x, y, z, w, h, d]
    [0, edgeH / 2, -STAGE_HALF_D, STAGE_WIDTH, edgeH, edgeThick],
    [0, edgeH / 2, STAGE_HALF_D, STAGE_WIDTH, edgeH, edgeThick],
    [-STAGE_HALF_W, edgeH / 2, 0, edgeThick, edgeH, STAGE_DEPTH],
    [STAGE_HALF_W, edgeH / 2, 0, edgeThick, edgeH, STAGE_DEPTH]
  ]
  return configs.map(([x, y, z, w, h, d]) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
    mesh.position.set(x, y, z)
    scene.add(mesh)
    return mesh
  })
}

// ─── helpers: item spawning ───────────────────────────────────────────────────

const spawnItems = (scene: THREE.Scene, world: SceneReference['world']): ItemObject[] => {
  const positions: [number, number, number][] = Array.from({ length: ITEM_COUNT }, (_, i) => {
    const angle = (i / ITEM_COUNT) * Math.PI * 2
    const radius = 2 + (i % 4) * 2
    return [
      Math.cos(angle) * radius * (STAGE_HALF_W / 12),
      ITEM_GROUND_Y,
      Math.sin(angle) * radius * (STAGE_HALF_D / 20)
    ]
  })

  return positions.map((pos) => {
    const cube = getCube(scene, world, {
      size: ITEM_SIZE,
      color: ITEM_COLOR,
      position: pos,
      origin: {},
      type: 'dynamic',
      restitution: 0.3,
      friction: 1.5,
      weight: 1,
      castShadow: true,
      receiveShadow: true
    })
    const body = cube.userData?.body as SceneReference['world']['createRigidBody'] extends (
      d: infer _
    ) => infer R
      ? R
      : never
    return { mesh: cube as unknown as THREE.Mesh, body: body as ItemObject['body'] }
  })
}

// ─── helpers: proximity push ─────────────────────────────────────────────────

const pushNearbyItems = (goombaPos: THREE.Vector3, items: ItemObject[]): void => {
  const rangeSq = GOOMBA_PUSH_RANGE * GOOMBA_PUSH_RANGE
  items.forEach(({ body }) => {
    if (!body) return
    const t = body.translation()
    const dx = t.x - goombaPos.x
    const dz = t.z - goombaPos.z
    const distributionSq = dx * dx + dz * dz
    if (distributionSq < 0.0001 || distributionSq > rangeSq) return
    const distribution = Math.sqrt(distributionSq)
    const inv = 1 / distribution
    const mag = GOOMBA_PUSH_IMPULSE
    body.applyImpulse({ x: dx * inv * mag, y: mag * 0.15, z: dz * inv * mag }, true)
  })
}

// ─── helpers: item sync ───────────────────────────────────────────────────────

const syncItems = (items: ItemObject[]): void => {
  items.forEach(({ mesh, body }) => {
    if (!body) return
    const t = body.translation()
    mesh.position.set(t.x, t.y, t.z)
    const r = body.rotation()
    mesh.quaternion.set(r.x, r.y, r.z, r.w)
  })
}

// ─── scoring: check items that left the stage ─────────────────────────────────

const checkItemExits = (ref: SceneReference): void => {
  const toRemove: number[] = []
  ref.items.forEach(({ body, mesh }, index) => {
    if (!body) return
    const t = body.translation()
    const exitedFar = t.z > EXIT_Z_FAR
    const exitedNear = t.z < EXIT_Z_NEAR
    const exitedSide = Math.abs(t.x) > EXIT_X

    if (!exitedFar && !exitedNear && !exitedSide) return

    if (exitedFar) {
      localScore.value++
      store.addScore(localPeerId.value, 1)
    } else if (exitedNear) {
      const remoteId = playerList.value.find((p) => p.id !== localPeerId.value)?.id
      if (remoteId) store.addScore(remoteId, 1)
    }

    ref.scene.remove(mesh)
    try {
      ref.world.removeRigidBody(body)
    } catch {
      /* already removed */
    }
    toRemove.push(index)
  })

  if (toRemove.length === 0) return
  const toRemoveSet = new Set(toRemove)
  ref.items = ref.items.filter((_, i) => !toRemoveSet.has(i))
}

// ─── path drawing state ───────────────────────────────────────────────────────

let isDrawing = false
let drawnPaths: Waypoint[][] = Array.from({ length: GOOMBA_COUNT }, () => [])

const updateGoombaPath = (ref: SceneReference, index: number): void => {
  const goomba = ref.localGoombas[index]
  if (!goomba) return
  if (goomba.pathLine) drawRemovePathVisualization(ref.scene, goomba.pathLine)
  if (drawnPaths[index].length < 2) {
    goomba.pathLine = null
    return
  }
  goomba.pathLine = drawCreatePathVisualization(ref.scene, drawnPaths[index], PATH_COLOR_LOCAL)
}

const highlightSelected = (ref: SceneReference): void => {
  ref.localGoombas.forEach((g, i) => {
    const mat = g.mesh.material as THREE.MeshToonMaterial
    mat.color.setHex(i === selectedGoomba.value ? SELECTED_GOOMBA_COLOR : GOOMBA_COLOR_LOCAL)
  })
}

// ─── pointer handlers ─────────────────────────────────────────────────────────

const onPointerDown = (event: PointerEvent): void => {
  if (phase.value !== 'planning' || !canvas.value || !sceneReference) return
  const ndc = getNdc(event, canvas.value)
  const worldPos = raycastGround(ndc, sceneReference.camera)
  if (!worldPos) return
  isDrawing = true
  drawnPaths[selectedGoomba.value] = [{ x: worldPos.x, y: GOOMBA_GROUND_Y, z: worldPos.z }]
  updateGoombaPath(sceneReference, selectedGoomba.value)
}

const onPointerMove = (event: PointerEvent): void => {
  if (!isDrawing || phase.value !== 'planning' || !canvas.value || !sceneReference) return
  const ndc = getNdc(event, canvas.value)
  const worldPos = raycastGround(ndc, sceneReference.camera)
  if (!worldPos) return
  const path = drawnPaths[selectedGoomba.value]
  const last = path[path.length - 1]
  if (!last) return
  const dx = worldPos.x - last.x
  const dz = worldPos.z - last.z
  if (Math.hypot(dx, dz) < MIN_WAYPOINT_DISTANCE) return
  drawnPaths[selectedGoomba.value] = [...path, { x: worldPos.x, y: GOOMBA_GROUND_Y, z: worldPos.z }]
  updateGoombaPath(sceneReference, selectedGoomba.value)
}

const onPointerUp = (): void => {
  isDrawing = false
}

// ─── scene setup callback ─────────────────────────────────────────────────────

type SetupArguments = Parameters<
  Parameters<typeof sceneStore.init>[2]['defineSetup'] extends (a: infer A) => void
    ? (a: A) => void
    : never
>[0]

const setupScene = ({ scene, camera, world, animate }: SetupArguments): void => {
  camera.position.set(0, 28, 0)
  camera.up.set(0, 0, -1)
  camera.lookAt(0, 0, 0)
  if ('updateProjectionMatrix' in camera)
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix()

  const edgeMeshes = buildStageEdges(scene)

  const localGoombas: GoombaObject[] = GOOMBA_POSITIONS_P1.map((pos) => ({
    mesh: makeGoomba(scene, pos, GOOMBA_COLOR_LOCAL),
    pathLine: null,
    waypoints: [],
    followState: null
  }))

  const remoteGoombas: GoombaObject[] = []
  const items: ItemObject[] = []

  sceneReference = { scene, camera, world, localGoombas, remoteGoombas, items, edgeMeshes }

  canvas.value?.addEventListener('pointerdown', onPointerDown)
  canvas.value?.addEventListener('pointermove', onPointerMove)
  canvas.value?.addEventListener('pointerup', onPointerUp)

  animate({
    timeline: createTimelineManager(),
    beforeTimeline: () => {
      if (phase.value !== 'battle' || !sceneReference) return
      world.step()
      syncItems(sceneReference.items)
      sceneReference.localGoombas.forEach((g) => {
        if (!g.followState) return
        const result = logicAdvanceAlongPath(g.followState, GOOMBA_FOLLOW_SPEED, 1 / 60)
        g.mesh.position.set(result.position.x, result.position.y, result.position.z)
        g.mesh.rotation.y = result.rotation
        g.followState = result.isComplete
          ? null
          : {
              waypoints: g.followState.waypoints,
              currentIndex: result.currentIndex,
              progress: result.progress
            }
        pushNearbyItems(g.mesh.position, sceneReference.items)
      })
      sceneReference.remoteGoombas.forEach((g) => {
        if (!g.followState) return
        const result = logicAdvanceAlongPath(g.followState, GOOMBA_FOLLOW_SPEED, 1 / 60)
        g.mesh.position.set(result.position.x, result.position.y, result.position.z)
        g.mesh.rotation.y = result.rotation
        g.followState = result.isComplete
          ? null
          : {
              waypoints: g.followState.waypoints,
              currentIndex: result.currentIndex,
              progress: result.progress
            }
        pushNearbyItems(g.mesh.position, sceneReference.items)
      })
      checkItemExits(sceneReference)
    }
  })
}

// ─── start planning ───────────────────────────────────────────────────────────

const startPlanning = async (): Promise<void> => {
  if (!canvas.value) return
  store.phase = 'planning'
  drawnPaths = Array.from({ length: GOOMBA_COUNT }, () => [])
  selectedGoomba.value = 0
  localScore.value = 0
  timerSeconds.value = PLANNING_DURATION_S

  await sceneStore.init(
    canvas.value,
    { ...sceneSetupConfig, orbit: { disabled: true } },
    { playMode: true, viewPanels: { showElements: false }, defineSetup: setupScene }
  )

  timerInterval = setInterval(() => {
    if (timerSeconds.value <= 0) {
      submitPaths()
      return
    }
    timerSeconds.value--
  }, 1000)
}

// ─── submit paths → start battle ─────────────────────────────────────────────

const submitPaths = (): void => {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  session.broadcastPaths(
    drawnPaths.map((path) => (path.length >= 2 ? drawInterpolateWaypoints(path) : path))
  )
  if (isHost.value) {
    const allReady =
      playerList.value.length >= 2 &&
      playerList.value.every((p) => p.ready || p.id === localPeerId.value)
    if (allReady) session.broadcastStart()
    else gameMessage.value = 'Waiting for opponent…'
  } else {
    gameMessage.value = 'Paths submitted — waiting for host to start…'
  }
}

// ─── watch for battle start ───────────────────────────────────────────────────

watch(phase, async (newPhase) => {
  if (newPhase === 'planning') return
  if (newPhase !== 'battle' || !sceneReference) return

  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }

  const ref = sceneReference
  gameMessage.value = ''
  timerSeconds.value = BATTLE_DURATION_S

  // Spawn remote goombas using opponent's paths
  const opponent = playerList.value.find((p) => p.id !== localPeerId.value)
  if (opponent) {
    GOOMBA_POSITIONS_P2.forEach((pos, i) => {
      const mesh = makeGoomba(ref.scene, pos, GOOMBA_COLOR_REMOTE)
      mesh.rotation.y = Math.PI
      const paths = opponent.paths[i] ?? []
      const pathLine =
        paths.length >= 2 ? drawCreatePathVisualization(ref.scene, paths, PATH_COLOR_REMOTE) : null
      const followState: PathFollowState | null =
        paths.length >= 2 ? { waypoints: paths, currentIndex: 0, progress: 0 } : null
      ref.remoteGoombas.push({ mesh, pathLine, waypoints: paths, followState })
    })
  }

  // Initialize local goombas follow states
  ref.localGoombas.forEach((g, i) => {
    const path = drawnPaths[i].length >= 2 ? drawInterpolateWaypoints(drawnPaths[i]) : []
    g.followState = path.length >= 2 ? { waypoints: path, currentIndex: 0, progress: 0 } : null
  })

  // Spawn items
  ref.items = spawnItems(ref.scene, ref.world)

  // Battle timer
  timerInterval = setInterval(() => {
    if (timerSeconds.value <= 0) {
      endBattle()
      return
    }
    timerSeconds.value--
  }, 1000)

  battleTimeout = setTimeout(endBattle, BATTLE_DURATION_S * 1000)
})

// ─── watch for both players ready (host only) ─────────────────────────────────

watch(playerList, () => {
  if (phase.value !== 'planning' || !isHost.value) return
  const allReady = playerList.value.length >= 2 && playerList.value.every((p) => p.ready)
  if (allReady) session.broadcastStart()
})

// ─── end battle ───────────────────────────────────────────────────────────────

const endBattle = (): void => {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  if (battleTimeout) {
    clearTimeout(battleTimeout)
    battleTimeout = null
  }
  session.broadcastScore(localScore.value)
  store.phase = 'summary'
  sceneStore.cleanup()
  sceneReference = null
}

// ─── play again ───────────────────────────────────────────────────────────────

const playAgain = (): void => {
  store.reset()
  session.reconnect(roomId.value)
}

// ─── lifecycle ────────────────────────────────────────────────────────────────

const onStart = (): void => {
  saveProfile({ name: playerName.value, color: playerColor.value })
  session.init()
  startPlanning()
}

const handleMatchFound = (newRoomId: string): void => {
  roomId.value = newRoomId
  router.replace({ query: { ...route.query, room: newRoomId } })
  session.reconnect(newRoomId)
}

const handleLeaveRoom = (): void => {
  router.replace({ query: { ...route.query, room: undefined } })
  session.reconnect(crypto.randomUUID())
}

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
  if (battleTimeout) clearTimeout(battleTimeout)
  canvas.value?.removeEventListener('pointerdown', onPointerDown)
  canvas.value?.removeEventListener('pointermove', onPointerMove)
  canvas.value?.removeEventListener('pointerup', onPointerUp)
  sceneStore.cleanup()
})

// ─── goomba select helpers ────────────────────────────────────────────────────

const selectGoomba = (index: number): void => {
  selectedGoomba.value = index
  if (sceneReference) highlightSelected(sceneReference)
}

const clearCurrentPath = (): void => {
  if (!sceneReference) return
  drawnPaths[selectedGoomba.value] = []
  updateGoombaPath(sceneReference, selectedGoomba.value)
}

watch(selectedGoomba, () => {
  if (sceneReference) highlightSelected(sceneReference)
})
</script>

<template>
  <div class="pf" :style="backgroundStyle">
    <!-- LOBBY -->
    <PathFightLobby
      v-if="phase === 'lobby'"
      :player-name="playerName"
      :player-color="playerColor"
      :is-host="isHost"
      :player-list="playerList"
      :room-id="roomId"
      @update:player-name="playerName = $event"
      @update:player-color="playerColor = $event"
      @name-change="session.updateProfile(playerName, playerColor)"
      @start-game="onStart"
      @match-found="handleMatchFound"
      @leave-room="handleLeaveRoom"
    />

    <!-- GAME (planning + battle) -->
    <template v-else-if="phase === 'planning' || phase === 'battle'">
      <div class="pf__game" :class="{ 'pf__game--show-sidebar': showSidebar }">
        <!-- Header bar -->
        <div class="pf__header">
          <span class="pf__phase-label">{{ phase === 'planning' ? 'Planning' : 'Battle' }}</span>
          <span class="pf__timer" :class="{ 'pf__timer--urgent': timerSeconds <= 10 }">
            {{ timerSeconds }}s
          </span>
          <span v-if="gameMessage" class="pf__message">{{ gameMessage }}</span>
          <span class="pf__score">Score: {{ localScore }}</span>
        </div>

        <!-- Canvas -->
        <div class="pf__canvas-wrap">
          <canvas ref="canvas" />
        </div>

        <!-- Planning controls -->
        <div v-if="phase === 'planning'" class="pf__controls">
          <div class="pf__goomba-picker">
            <button
              v-for="i in GOOMBA_COUNT"
              :key="i"
              class="pf__goomba-btn"
              :class="{ 'pf__goomba-btn--active': selectedGoomba === i - 1 }"
              type="button"
              :title="`Select goomba ${i}`"
              @click="selectGoomba(i - 1)"
            >
              {{ i }}
            </button>
          </div>
          <button class="pf__ctrl-btn" type="button" @click="clearCurrentPath">Clear</button>
          <button class="pf__ctrl-btn pf__ctrl-btn--ready" type="button" @click="submitPaths">
            Ready ✓
          </button>
        </div>

        <!-- Sidebar -->
        <MultiplayerSidebar
          class="pf__sidebar"
          :players="sidebarPlayers"
          :local-peer-id="localPeerId"
          :messages="messages"
          chat-placeholder="Say something…"
          @send="session.broadcastChat"
        />
      </div>

      <GameTabBar
        :show-sidebar="showSidebar"
        :unread-count="unreadCount"
        @toggle="showSidebar = !showSidebar"
      />
    </template>

    <!-- SUMMARY -->
    <div v-else-if="phase === 'summary'" class="pf__summary">
      <div class="pf__summary-card">
        <h2 class="pf__summary-title">Results</h2>
        <ul class="pf__summary-scores">
          <li
            v-for="player in playerList"
            :key="player.id"
            class="pf__summary-row"
            :class="{ 'pf__summary-row--local': player.id === localPeerId }"
          >
            <span class="pf__summary-dot" :style="{ background: player.color }" />
            <span class="pf__summary-name">{{ player.name }}</span>
            <span class="pf__summary-pts">{{ player.score }} pts</span>
          </li>
        </ul>
        <p class="pf__summary-winner">
          {{
            (() => {
              const sorted = [...playerList].sort((a, b) => b.score - a.score)
              if (sorted[0]?.score === sorted[1]?.score) return 'Draw!'
              return sorted[0]?.id === localPeerId ? 'You win! 🎉' : `${sorted[0]?.name} wins!`
            })()
          }}
        </p>
        <button v-if="isHost" class="pf__play-again" type="button" @click="playAgain">
          Play again
        </button>
        <p v-else class="pf__waiting-host">Waiting for host to restart…</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pf {
  width: 100%;
  height: 100vh;
  padding-top: var(--nav-height);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: var(--game-surface);
  --game-accent: var(--pf-orange, #e67e22);
}

/* ── game layout ─────────────────────────────────── */

.pf__game {
  display: grid;
  grid-template-columns: 1fr var(--sidebar-width, 260px);
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    'header header'
    'canvas sidebar'
    'controls controls';
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.pf__header {
  grid-area: header;
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3);
  background: var(--game-surface-dim);
  border-bottom: 2px solid var(--game-border);
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--game-ink);
}

.pf__phase-label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: var(--font-size-xs);
  color: var(--game-ink-muted);
}

.pf__timer {
  font-variant-numeric: tabular-nums;
  font-size: var(--font-size-md);
}

.pf__timer--urgent {
  color: #e74c3c;
  animation: pf-pulse 0.5s ease-in-out infinite alternate;
}

@keyframes pf-pulse {
  from {
    opacity: 1;
  }
  to {
    opacity: 0.5;
  }
}

.pf__message {
  flex: 1;
  color: var(--game-ink-muted);
}

.pf__score {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.pf__canvas-wrap {
  grid-area: canvas;
  position: relative;
  min-height: 0;
  overflow: hidden;
}

.pf__canvas-wrap canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.pf__controls {
  grid-area: controls;
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  background: var(--game-surface-dim);
  border-top: 2px solid var(--game-border);
  overflow-x: auto;
}

.pf__goomba-picker {
  display: flex;
  gap: var(--spacing-1);
  flex-wrap: nowrap;
}

.pf__goomba-btn {
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--game-border);
  border-radius: 50%;
  background: var(--game-surface-subtle);
  color: var(--game-ink);
  font-size: var(--font-size-xs);
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.1s ease;
}

.pf__goomba-btn:hover {
  transform: translate(-1px, -1px);
}

.pf__goomba-btn--active {
  background: #f1c40f;
  border-color: #d4ac0d;
  color: #111;
}

.pf__ctrl-btn {
  padding: var(--spacing-1) var(--spacing-3);
  border: 2px solid var(--game-border);
  border-radius: 999px;
  background: var(--game-surface-subtle);
  color: var(--game-ink);
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.pf__ctrl-btn--ready {
  margin-left: auto;
  background: var(--pf-orange, #e67e22);
  color: #fff;
  border-color: transparent;
}

.pf__sidebar {
  grid-area: sidebar;
}

/* ── mobile ──────────────────────────────────────── */

@media (max-width: 720px) {
  .pf__game {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
    grid-template-areas:
      'header'
      'canvas'
      'controls';
    padding-bottom: 3rem;
  }

  .pf__sidebar {
    display: none;
    position: fixed;
    inset: var(--nav-height) 0 3rem 0;
    z-index: 20;
    background: var(--game-surface);
    overflow-y: auto;
  }

  .pf__game--show-sidebar .pf__sidebar {
    display: flex;
    flex-direction: column;
  }

  .pf__game--show-sidebar .pf__canvas-wrap {
    display: none;
  }
}

/* ── summary ─────────────────────────────────────── */

.pf__summary {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-4);
}

.pf__summary-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-5, 2rem) var(--spacing-6, 2.5rem);
  background: var(--game-surface-subtle);
  border: 3px solid var(--game-border);
  border-radius: 1.5rem;
  box-shadow: 5px 5px 0 var(--game-border);
  min-width: 18rem;
}

.pf__summary-title {
  margin: 0;
  font-size: var(--font-size-lg, 1.5rem);
  font-weight: 900;
  color: var(--game-ink);
}

.pf__summary-scores {
  list-style: none;
  padding: 0;
  margin: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.pf__summary-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  border: 2px solid var(--game-border);
  border-radius: 999px;
  background: var(--game-surface-subtle);
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--game-ink);
}

.pf__summary-row--local {
  background: var(--game-surface-dim);
}

.pf__summary-dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.pf__summary-name {
  flex: 1;
}

.pf__summary-pts {
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}

.pf__summary-winner {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 900;
  color: var(--game-ink);
}

.pf__play-again {
  padding: var(--spacing-2) var(--spacing-5, 1.5rem);
  border: 3px solid var(--game-border);
  border-radius: 999px;
  background: var(--pf-orange, #e67e22);
  color: #fff;
  font-size: var(--font-size-md);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 3px 3px 0 var(--game-border);
  transition: transform 0.1s ease;
  font-family: inherit;
}

.pf__play-again:hover {
  transform: translate(-1px, -1px);
}

.pf__waiting-host {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--game-ink-muted);
}
</style>
