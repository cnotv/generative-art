<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import * as THREE from 'three'
import { createTimelineManager } from '@webgamekit/animation'
import { useSceneViewStore } from '@/stores/sceneView'
import { buildGround, buildWalls, buildHoleMarker } from './helpers/course'
import { createBall, syncBall, shootBall, isBallStopped, resetBall } from './helpers/ball'
import { createAimState, beginDrag, updateDrag, endDrag } from './helpers/input'
import { HOLES, CAMERA_OFFSET_THIRD, MAX_SHOT_POWER, WIN_DISTANCE, MAX_STROKES } from './config'
import type { BallState } from './helpers/ball'

const canvas = ref<HTMLCanvasElement | null>(null)
const store = useSceneViewStore()

const holeIndex = ref(0)
const strokes = ref(0)
const message = ref('')
const waiting = ref(false)
const aimPower = ref(0)

const HOLE = HOLES[holeIndex.value]

let cleanupListeners: (() => void) | null = null

const followCamera = (camera: THREE.Camera, ball: BallState, aimDirection: THREE.Vector3) => {
  const behind = aimDirection.clone().negate().normalize()
  camera.position.set(
    ball.mesh.position.x + behind.x * CAMERA_OFFSET_THIRD[2],
    ball.mesh.position.y + CAMERA_OFFSET_THIRD[1],
    ball.mesh.position.z + behind.z * CAMERA_OFFSET_THIRD[2]
  )
  camera.lookAt(ball.mesh.position)
}

onMounted(async () => {
  if (!canvas.value) return

  await store.init(
    canvas.value,
    {},
    {
      defineSetup: ({ scene, camera, world, animate }) => {
        buildGround(HOLE, scene, world)
        buildWalls(HOLE, scene, world)
        buildHoleMarker(HOLE.holePosition, scene)

        const ballState: BallState = createBall(HOLE.teePosition, scene, world)
        const aim = createAimState()
        const holeVec = new THREE.Vector3(...HOLE.holePosition)

        aim.direction.set(0, 0, 1)
        camera.position.set(
          HOLE.teePosition[0],
          HOLE.teePosition[1] + CAMERA_OFFSET_THIRD[1],
          HOLE.teePosition[2] + CAMERA_OFFSET_THIRD[2]
        )
        camera.lookAt(new THREE.Vector3(...HOLE.teePosition))

        const onPointerDown = (e: PointerEvent) => {
          if (waiting.value || !isBallStopped(ballState)) return
          beginDrag(aim, e.clientX, e.clientY)
        }
        const onPointerMove = (e: PointerEvent) => {
          if (!aim.dragging) return
          updateDrag(aim, e.clientX, e.clientY, camera, ballState.mesh.position)
          aimPower.value = Math.round(aim.power * 100)
        }
        const onPointerUp = (e: PointerEvent) => {
          if (!aim.dragging) return
          updateDrag(aim, e.clientX, e.clientY, camera, ballState.mesh.position)
          if (!endDrag(aim) || strokes.value >= MAX_STROKES) return
          strokes.value++
          aimPower.value = 0
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

        const timeline = createTimelineManager()
        animate({
          timeline,
          beforeTimeline: () => {
            syncBall(ballState)
            if (isBallStopped(ballState)) followCamera(camera, ballState, aim.direction)
            if (waiting.value || !isBallStopped(ballState) || strokes.value === 0) return
            const distribution = ballState.mesh.position.distanceTo(holeVec)
            const isHoled = distribution < WIN_DISTANCE
            const isMaxed = strokes.value >= MAX_STROKES
            if (!isHoled && !isMaxed) return
            message.value = isHoled
              ? `Hole in ${strokes.value}! Par ${HOLE.par}`
              : `Max strokes — resetting`
            waiting.value = true
            setTimeout(() => {
              resetBall(ballState, HOLE.teePosition)
              strokes.value = 0
              message.value = ''
              waiting.value = false
            }, 2000)
          }
        })
      }
    }
  )
})

onUnmounted(() => {
  cleanupListeners?.()
  store.cleanup()
})
</script>

<template>
  <div class="minigolf-third">
    <canvas ref="canvas" />
    <div class="minigolf-third__hud">
      <span>Hole {{ holeIndex + 1 }} · Par {{ HOLE.par }}</span>
      <span>Strokes: {{ strokes }}</span>
      <span v-if="aimPower > 0" class="minigolf-third__power">Power: {{ aimPower }}%</span>
    </div>
    <div v-if="message" class="minigolf-third__message">{{ message }}</div>
    <div class="minigolf-third__hint">Drag to aim &amp; power, release to shoot</div>
  </div>
</template>

<style scoped>
.minigolf-third {
  position: relative;
  width: 100%;
  height: 100vh;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.minigolf-third__hud {
  position: absolute;
  top: calc(var(--nav-height) + var(--spacing-2));
  left: var(--spacing-3);
  display: flex;
  gap: var(--spacing-3);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-foreground);
  background: var(--color-background);
  padding: var(--spacing-1) var(--spacing-2);
  border-radius: var(--radius-sm);
  opacity: 0.9;
}

.minigolf-third__power {
  color: var(--color-perf-warn);
}

.minigolf-third__message {
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
}

.minigolf-third__hint {
  position: absolute;
  bottom: var(--spacing-3);
  left: 50%;
  transform: translateX(-50%);
  font-size: var(--font-size-xs);
  color: var(--color-foreground);
  opacity: 0.6;
}
</style>
