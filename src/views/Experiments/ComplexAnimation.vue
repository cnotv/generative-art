<script setup lang="ts">
import * as THREE from 'three'
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useDebugSceneStore } from '@/stores/debugScene'
import { video } from '@/utils/video'
import { controls } from '@/utils/control'
import { stats } from '@/utils/stats'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import RAPIER from '@dimforge/rapier3d-compat'
import {
  getLights,
  getGround,
  getRenderer,
  loadAnimation,
  loadFBX,
  loadGLTF,
  setThirdPersonCamera,
  cloneModel,
  instanceMatrixMesh,
  getInstanceConfig
} from '@webgamekit/threejs'
import { complexAnimation as config } from '@/config/scenes'
import { getBlade } from '@/utils/custom-models'
import type { CoordinateTuple } from '@webgamekit/animation'

const statsElement = ref(null)
const canvas = ref(null)
const route = useRoute()
const { registerSceneElements, clearSceneElements } = useDebugSceneStore()

onMounted(async () => {
  ;(init(
    canvas.value as unknown as HTMLCanvasElement,
    statsElement.value as unknown as HTMLElement
  ),
    statsElement.value!)
})

onUnmounted(() => {
  clearSceneElements()
})

const populateModels = async (
  scene: THREE.Scene,
  instancedModels: ReturnType<typeof getInstanceConfig> | Record<string, never>
) => {
  if (config.tree.show) {
    const { model: tree } = await loadGLTF('tree.glb')
    cloneModel(tree, scene, instancedModels as ReturnType<typeof getInstanceConfig>)
  }
  if (config.grass.show) {
    const grass = getBlade(config.grass)
    instanceMatrixMesh(grass, scene, instancedModels as ReturnType<typeof getInstanceConfig>)
  }
  if (config.mushroom.show) {
    const { model: mushroom } = await loadGLTF('cute_mushrooms.glb')
    cloneModel(mushroom, scene, instancedModels as ReturnType<typeof getInstanceConfig>)
  }
}

const setup = async (canvas: HTMLCanvasElement) => {
  await RAPIER.init()
  const groundSize = [500.0, 0.1, 500.0] as CoordinateTuple
  const groundPosition = [1, 0, 1] as CoordinateTuple
  const world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 })
  const renderer = getRenderer(canvas)
  const camera = new THREE.PerspectiveCamera(
    config.camera.fov,
    config.camera.aspect,
    config.camera.near,
    config.camera.far
  )
  const scene = new THREE.Scene()
  const orbit = new OrbitControls(camera, renderer.domElement)
  const clock = new THREE.Clock()
  const instancedModels = {
    tree: config.tree.show ? getInstanceConfig(config.tree, groundSize) : {},
    grass: config.grass.show ? getInstanceConfig(config.grass, groundSize) : {},
    mushroom: config.mushroom.show ? getInstanceConfig(config.mushroom, groundSize) : {}
  }

  camera.position.set(-30, 25, 30)
  scene.fog = new THREE.Fog(0xaaaaff, 1)

  const { directionalLight } = getLights(scene)
  getGround(scene, world, {
    size: groundSize[0],
    position: groundPosition,
    color: 0x33aa00
  })

  const girl = await loadFBX('character.fbx', {
    position: [0, 0, 0],
    scale: [0.1, 0.1, 0.1]
  })
  const animationWalk = await loadAnimation(girl, 'walk.fbx')
  scene.add(girl)

  await populateModels(scene, instancedModels.tree)

  registerSceneElements(camera, scene.children)
  video.record(canvas, route)

  const animate = () => {
    stats.start(route)
    requestAnimationFrame(animate)
    const delta = clock.getDelta()
    if (config.walk) {
      animationWalk.update(delta)
      girl.position.z += 0.15
    }
    directionalLight.position.copy({
      x: girl.position.x + 5,
      y: girl.position.y + 5,
      z: girl.position.z + 5
    })
    if (config.camera.fixed) {
      setThirdPersonCamera(camera, config.camera, girl)
    }
    orbit.update()
    renderer.render(scene, camera)
    video.stop(renderer.info.render.frame, route)
    stats.end(route)
  }
  animate()
}

const init = async (canvas: HTMLCanvasElement, statsElement: HTMLElement) => {
  stats.init(route, statsElement)
  controls.create(
    config,
    route,
    {
      walk: {},
      camera: { fixed: {}, near: {}, aspect: {}, far: {}, fov: {} },
      tree: { show: {}, amount: {} },
      grass: { show: {}, amount: {} },
      mushroom: { show: {}, amount: {} }
    },
    () => {
      setup(canvas)
    }
  )
  setup(canvas)
}
</script>

<template>
  <div ref="statsElement"></div>
  <canvas ref="canvas"></canvas>
</template>
