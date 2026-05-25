<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { controls } from '@/utils/control'
import { stats } from '@/utils/stats'
import * as THREE from 'three'

import { getModel, getTools, type ComplexModel } from '@webgamekit/threejs'
import type { LoadProgress } from '@webgamekit/threejs'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import {
  controllerForward,
  resetAnimation,
  bindAnimatedElements,
  controllerJump,
  controllerTurn,
  createTimelineManager,
  type Timeline,
  type CoordinateTuple,
  type AnimationData
} from '@webgamekit/animation'
import { getBall, getCube } from '@webgamekit/threejs'
import brickTexture from '@/assets/images/textures/brick.jpg'
import { getCoinBlock } from '@/utils/custom-models'
import type { RotationMap } from '@/types/three'

const statsElement = ref(null)
const canvas = ref(null)
const route = useRoute()

const loadingVisible = ref(true)
const loadingStage = ref('Loading…')
const loadingDetail = ref<string | undefined>(undefined)
const handleProgress = (progress: LoadProgress): void => {
  loadingVisible.value = !progress.done
  loadingStage.value = progress.stage
  loadingDetail.value = progress.detail
}

let initInstance: () => void
onMounted(() => {
  initInstance = () => {
    init(canvas.value as unknown as HTMLCanvasElement, statsElement.value as unknown as HTMLElement)
  }

  initInstance()
  window.addEventListener('resize', initInstance)
})
onUnmounted(() => window.removeEventListener('resize', initInstance))

const config = {
  directional: {
    enabled: true,
    helper: false,
    intensity: 2
  }
}

const rotationMap: RotationMap = {
  forward: 0,
  left: 90,
  backward: 180,
  right: 270
}

const character = {
  speed: 0.5,
  jump: 2.8
}

// Helper to create AnimationData for goomba models
const createGoombaAnimData = (model: ComplexModel, getDelta: () => number): AnimationData => ({
  player: model,
  actionName: 'run',
  delta: getDelta(),
  distance: character.speed
})

type TimelineTools = Awaited<ReturnType<typeof getTools>>

const makeTimeline1 =
  (cubes: any[], getDelta: () => number) =>
  (model: ComplexModel): Timeline[] => [
    {
      interval: [100, 100] as [number, number],
      actionStart: () => controllerTurn(model, rotationMap['backward']),
      action: () => controllerForward(cubes, [], createGoombaAnimData(model, getDelta))
    },
    {
      interval: [100, 100] as [number, number],
      delay: 100,
      actionStart: () => controllerTurn(model, rotationMap['backward']),
      action: () => controllerForward(cubes, [], createGoombaAnimData(model, getDelta))
    },
    {
      interval: [20, 180] as [number, number],
      delay: 230,
      action: () => controllerJump(model, cubes, character.speed, character.jump)
    },
    {
      interval: [1, 250] as [number, number],
      delay: 250,
      action: () => resetAnimation([model])
    }
  ]

const makeTimeline2 =
  (cubes: any[], getDelta: () => number) =>
  (model: ComplexModel): Timeline[] => [
    {
      interval: [120, 480] as [number, number],
      actionStart: () => controllerTurn(model, rotationMap['backward']),
      action: () => controllerForward(cubes, [], createGoombaAnimData(model, getDelta))
    },
    {
      interval: [120, 480] as [number, number],
      delay: 120,
      actionStart: () => controllerTurn(model, rotationMap['right']),
      action: () => controllerForward(cubes, [], createGoombaAnimData(model, getDelta))
    },
    {
      interval: [20, 580] as [number, number],
      delay: 200,
      action: () => controllerJump(model, cubes, 0.5, character.jump)
    },
    {
      interval: [120, 480] as [number, number],
      delay: 240,
      actionStart: () => controllerTurn(model, rotationMap['backward']),
      action: () => controllerForward(cubes, [], createGoombaAnimData(model, getDelta))
    },
    {
      interval: [120, 480] as [number, number],
      delay: 360,
      actionStart: () => controllerTurn(model, rotationMap['left']),
      action: () => controllerForward(cubes, [], createGoombaAnimData(model, getDelta))
    }
  ]

const makeTimeline3 =
  (cubes: any[], getDelta: () => number) =>
  (model: ComplexModel): Timeline[] => [
    {
      interval: [200, 200] as [number, number],
      actionStart: () => controllerTurn(model, rotationMap['backward']),
      action: () => controllerForward(cubes, [], createGoombaAnimData(model, getDelta))
    },
    {
      interval: [100, 300] as [number, number],
      delay: 200,
      actionStart: () => controllerTurn(model, rotationMap['backward']),
      action: () => controllerForward(cubes, [], createGoombaAnimData(model, getDelta))
    }
  ]

const makeTimeline4 =
  (cubes: any[], getDelta: () => number) =>
  (model: ComplexModel): Timeline[] => [
    {
      interval: [100, 100] as [number, number],
      action: () => controllerForward(cubes, [], createGoombaAnimData(model, getDelta))
    },
    {
      interval: [100, 100] as [number, number],
      delay: 100,
      actionStart: () => controllerTurn(model, rotationMap['right']),
      action: () => controllerForward(cubes, [], createGoombaAnimData(model, getDelta))
    }
  ]

const makeTimeline6 =
  (cubes: any[], getDelta: () => number) =>
  (model: ComplexModel): Timeline[] => [
    {
      interval: [1, 0] as [number, number],
      actionStart: () => controllerTurn(model, 1),
      action: () => controllerForward(cubes, [], createGoombaAnimData(model, getDelta))
    },
    {
      interval: [20, 100] as [number, number],
      delay: 100,
      action: () => controllerJump(model, cubes, character.speed, character.jump)
    }
  ]

type SceneWorld = Pick<TimelineTools, 'scene' | 'world'>

const setupStaticObjects = ({ scene, world }: SceneWorld) => {
  const coins = [[0, 3, 2]].map(([x, y, z]) =>
    getCoinBlock(scene, world, { position: [30 * x, 30 * y + 15, -30 * z] })
  )
  const cubes = [
    [0, 0, 0],
    [0, 0, 1],
    [0, 0, 2],
    [0, 1, 2],
    [-1, 0, 2],
    [-2, 0, 0],
    [-2, 0, 1],
    [-2, 0, 2]
  ].map(([x, y, z]) =>
    getCube(scene, world, {
      size: [30, 30, 30],
      restitution: -1,
      position: [30 * x, 30 * y + 12, -30 * z],
      type: 'fixed',
      texture: brickTexture,
      boundary: 0.5,
      color: 0x888888
    })
  )
  const balls = [
    getBall(scene, world, { size: 10, position: [0, 90, -30], showHelper: false }),
    getBall(scene, world, { size: 10, position: [0, 90, -30], showHelper: false }),
    getBall(scene, world, { size: 10, position: [0, 90, -30], showHelper: false, type: 'fixed' }),
    getBall(scene, world, {
      size: 10,
      position: [30, 90, 30],
      showHelper: false,
      hasGravity: true,
      type: 'kinematicPositionBased'
    })
  ]
  const movingCube = getCube(scene, world, {
    size: [30, 30, 30],
    restitution: -1,
    position: [30 * 0, 30 * 0 + 15, -30 * -5],
    type: 'kinematicPositionBased',
    texture: brickTexture,
    boundary: 0.5,
    color: 0x888888
  })
  return { coins, cubes, balls, movingCube }
}

const loadGoombas = async ({ scene, world }: SceneWorld) => {
  const getGoomba = (position: CoordinateTuple, rotation?: CoordinateTuple) =>
    getModel(scene, world, 'goomba.glb', {
      position,
      rotation,
      scale: [0.3, 0.3, 0.3],
      size: 15,
      restitution: -10,
      boundary: 0.5,
      type: 'kinematicPositionBased',
      weight: 50,
      angular: 10,
      showHelper: false,
      enabledRotations: [false, true, false],
      hasGravity: true
    })
  return Promise.all([
    getGoomba([0, 30, 0]),
    getGoomba([-60, 30, 0]),
    getGoomba([-60, 0, 60]),
    getGoomba([-30 * 5, 0, -30]),
    getGoomba([30 * 0, 30 * 2 + 15, -30 * -5], [0, rotationMap['right'], 0]),
    getGoomba([30, 0, 30 * 2])
  ])
}

const buildTimeline = async ({
  scene,
  world,
  getDelta,
  animate
}: Pick<TimelineTools, 'scene' | 'world' | 'getDelta' | 'animate'>): Promise<void> => {
  const { coins, cubes, balls, movingCube } = setupStaticObjects({ scene, world })
  const [goomba1, goomba2, goomba3, goomba4, goomba5, goomba6] = await loadGoombas({ scene, world })

  const cubeUp = new THREE.Vector3(0, 0.5, 0)
  const cubeDown = new THREE.Vector3(0, -0.5, 0)
  const movingCubeTimeline: Timeline[] = [
    {
      interval: [100, 100] as [number, number],
      action: () => movingCube.userData.body.setTranslation(movingCube.position.add(cubeUp), true)
    },
    {
      interval: [100, 100] as [number, number],
      delay: 100,
      action: () => movingCube.userData.body.setTranslation(movingCube.position.add(cubeDown), true)
    }
  ]

  const elements: any[] = [
    ...balls,
    goomba1,
    goomba2,
    goomba3,
    goomba4,
    goomba5,
    goomba6,
    movingCube,
    ...cubes
  ]

  const timelineManager = createTimelineManager()
  timelineManager.addActions([
    ...makeTimeline1(cubes, getDelta)(goomba1),
    ...makeTimeline2(cubes, getDelta)(goomba2),
    ...makeTimeline3(cubes, getDelta)(goomba3),
    ...makeTimeline4(cubes, getDelta)(goomba4),
    ...movingCubeTimeline,
    ...makeTimeline6(cubes, getDelta)(goomba6)
  ])
  timelineManager.addAction({
    start: 0,
    category: 'visual-effects',
    action: () => coins.forEach((coin) => (coin.rotation.z += 0.05))
  })
  timelineManager.addAction({
    interval: [1, 50] as [number, number],
    category: 'physics',
    action: () =>
      elements.push(getBall(scene, world, { size: 10, position: [0, 90, -30], showHelper: false }))
  })
  animate({
    beforeTimeline: () => bindAnimatedElements(elements, world, getDelta()),
    timeline: timelineManager
  })
}

const createScene = async (canvas: HTMLCanvasElement): Promise<void> => {
  const { animate, setup, scene, world, getDelta } = await getTools({
    stats,
    route,
    canvas,
    onProgress: handleProgress
  })
  setup({
    config: {
      camera: { position: [-184, 84, 48] },
      ground: { size: 100000, color: 0x227755 },
      sky: { texture: '../assets/landscape.jpg', size: 700 },
      lights: { directional: { intensity: config.directional.intensity } }
    },
    defineSetup: async () => buildTimeline({ scene, world, getDelta, animate })
  })
}

const init = async (canvasElement: HTMLCanvasElement, statsElement: HTMLElement): Promise<void> => {
  stats.init(route, statsElement)
  controls.create(config, route, {}, () => createScene(canvasElement))
  createScene(canvasElement)
}
</script>

<template>
  <div ref="statsElement"></div>
  <canvas ref="canvas"></canvas>
  <LoadingOverlay :visible="loadingVisible" :stage="loadingStage" :detail="loadingDetail" />
</template>
