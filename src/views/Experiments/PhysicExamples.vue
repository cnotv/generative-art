<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useDebugSceneStore } from '@/stores/debugScene'
import { video } from '@/utils/video'
import { controls } from '@/utils/control'
import { stats } from '@/utils/stats'
import { getLights, getEnvironment, getGround, removeElements } from '@webgamekit/threejs'
import {
  bindAnimatedElements,
  resetAnimation,
  animateTimeline,
  createTimelineManager
} from '@webgamekit/animation'
import { getWalls } from '@webgamekit/threejs'
import { PHYSIC_BALLS, spawnPhysicBall } from '@/utils/physicBalls'
import { times } from '@/utils/lodash'
import type { CoordinateTuple } from '@/types/three'

const statsElement = ref(null)
const canvas = ref(null)
const route = useRoute()
const { registerSceneElements, clearSceneElements } = useDebugSceneStore()
let animationFrameId = 0

onMounted(() => {
  ;(init(
    canvas.value as unknown as HTMLCanvasElement,
    statsElement.value as unknown as HTMLElement
  ),
    statsElement.value!)
})

onUnmounted(() => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  clearSceneElements()
})

const init = async (canvas: HTMLCanvasElement, statsElement: HTMLElement) => {
  const config = {
    directional: {
      enabled: true,
      helper: false,
      intensity: 2
    },
    ambient: {
      enabled: true,
      intensity: 2
    }
  }
  stats.init(route, statsElement)
  controls.create(config, route, {}, () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
    setup()
  })

  const setup = async () => {
    const length = 400
    const { renderer, scene, camera, clock, world } = await getEnvironment(canvas, {
      camera: { position: [0, 50, 200] }
    })
    getLights(scene, { directionalLightIntensity: config.directional.intensity })
    getGround(scene, world, { size: 1000.0 })
    getWalls(scene, world, { length, height: 150, depth: 0.2 })

    registerSceneElements(camera, scene.children)

    let experiments = [] as any[]
    // Rubber, Balloon, Bowling, Paper, Tennis, Ping Pong — shared with the marble
    // editor spawner, at their original arena sizes (no editor-scale overrides).
    const balls = PHYSIC_BALLS.map(
      (preset) => (position: CoordinateTuple) => spawnPhysicBall(scene, world, preset, position)
    )
    const addBall = async (position: CoordinateTuple, pick: number, list = balls) => {
      experiments.push(await list[pick](position))
    }

    document.addEventListener('click', async (event) => {
      const x = -(event.clientX - window.innerWidth / 2) / 50
      const y = -(event.clientY - window.innerHeight) / 50

      const pick = Math.floor(Math.random() * balls.length)
      addBall([x, 70, y], pick)
    })

    const generateBalls = (amount: number, list: any[]) => {
      const gaps = { x: 50, y: 10, z: 50 }
      const getSign = () => (Math.random() > 0.5 ? 1 : -1)

      times(amount, (i) => {
        // const rows = 3;
        // const x = -(length / 2 - gaps.x) + (i % rows) * gaps.x;
        // const z = 5 + Math.floor(i / rows) * -gaps.z;
        const x = getSign() * Math.floor((Math.random() * length) / 2 - gaps.x)
        const z = getSign() * Math.floor((Math.random() * length) / 2 - gaps.z)
        const y = 50 + (i + gaps.y)
        const pick = i % list.length
        addBall([x, y, z], pick, list)
      })
    }

    const timelineManager = createTimelineManager()
    timelineManager.addAction({
      interval: [1, 500],
      actionStart: (loop) => {
        experiments = removeElements(world, experiments)
        generateBalls(500, [balls[loop % balls.length]])
      },
      action: () => {
        experiments = resetAnimation(experiments)
      }
    })

    video.record(canvas, route)
    generateBalls(500, [balls[0]])
    function animate() {
      stats.start(route)
      const delta = clock.getDelta()
      animationFrameId = requestAnimationFrame(animate)
      world.step()

      bindAnimatedElements(experiments, world, delta)

      animateTimeline(timelineManager, animationFrameId)

      renderer.render(scene, camera)
      video.stop(renderer.info.render.frame, route)
      stats.end(route)
    }
    animate()
  }
  setup()
}
</script>

<template>
  <div ref="statsElement"></div>
  <canvas ref="canvas"></canvas>
</template>
