<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import * as THREE from 'three'
import {
  generateAreaPositions,
  getBall,
  getCube,
  getCylinder,
  seededRandomValues
} from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'
import type { CoordinateTuple } from '@webgamekit/animation'
import { useSceneViewStore } from '@/stores/sceneView'
import { useViewPanelsStore } from '@/stores/viewPanels'
import { createReactiveConfig, registerViewConfig, unregisterViewConfig } from '@/stores/viewConfig'
import {
  canopyCenterFor,
  canopySizeFor,
  isOnRoadSurface,
  isRoadLeaf,
  leafColorFor,
  leafRestHeight,
  leafXFor,
  leafZFor,
  pickPaletteColor,
  trunkDimensions,
  vergeXFor
} from './forestRoad'
import {
  CANOPY_COLORS,
  DEFAULT_CANOPY_SWAY,
  DEFAULT_LEAF_DENSITY,
  DEFAULT_ROAD_WETNESS,
  LEAF_COUNT,
  LEAF_END_Z,
  LEAF_HEIGHT,
  LEAF_ROAD_SHARE,
  LEAF_SEED,
  LEAF_SPREAD_X,
  LEAF_START_Z,
  LEAF_WIDTH,
  RANDOM_MIDPOINT,
  ROAD_COLOR,
  ROAD_LENGTH,
  ROAD_ROUGHNESS_DRY,
  ROAD_ROUGHNESS_WET_DROP,
  ROAD_START_Z,
  ROAD_THICKNESS,
  ROAD_TOP_Y,
  ROAD_WIDTH,
  SWAY_AMPLITUDE,
  SWAY_SPEED,
  TREE_LAYOUT_SEED,
  TRUNK_COLORS,
  UNDERGROWTH_COLORS,
  UNDERGROWTH_MAX_SIZE,
  UNDERGROWTH_MIN_SIZE,
  UNDERGROWTH_SEED,
  VERGE_CLEARANCE,
  configControls,
  leftTreeArea,
  rightTreeArea,
  setupConfig,
  undergrowthArea
} from './config'

const route = useRoute()
const canvas = ref<HTMLCanvasElement | null>(null)
const store = useSceneViewStore()
const { setViewPanels, clearViewPanels } = useViewPanelsStore()

const reactiveConfig = createReactiveConfig({
  leafDensity: DEFAULT_LEAF_DENSITY,
  roadWetness: DEFAULT_ROAD_WETNESS,
  canopySway: DEFAULT_CANOPY_SWAY
})

const SWAY_PHASE_STEP = 0.7

let roadMaterial: THREE.MeshPhysicalMaterial | null = null
let leafMesh: THREE.InstancedMesh | null = null
let canopyBaseX: number[] = []

const roadHalfWidth = ROAD_WIDTH / 2

const buildRoad = (
  scene: THREE.Scene,
  world: Parameters<typeof getCube>[1],
  wetness: number
): void => {
  const road = getCube(scene, world, {
    name: 'forest-road-surface',
    size: [ROAD_WIDTH, ROAD_THICKNESS, ROAD_LENGTH] as CoordinateTuple,
    position: [
      0,
      ROAD_TOP_Y - ROAD_THICKNESS / 2,
      ROAD_START_Z - ROAD_LENGTH / 2
    ] as CoordinateTuple,
    color: ROAD_COLOR,
    material: 'MeshPhysicalMaterial',
    roughness: ROAD_ROUGHNESS_DRY - ROAD_ROUGHNESS_WET_DROP * wetness,
    clearcoat: wetness,
    castShadow: false,
    receiveShadow: true,
    type: 'fixed',
    hasGravity: false
  })
  roadMaterial = road.material as THREE.MeshPhysicalMaterial
}

const buildTrees = (scene: THREE.Scene, world: Parameters<typeof getCube>[1]): THREE.Mesh[] => {
  const positions = [
    ...generateAreaPositions(leftTreeArea),
    ...generateAreaPositions(rightTreeArea)
  ]
  const randomValues = seededRandomValues(TREE_LAYOUT_SEED, positions.length)
  return positions.map((position, index) => {
    const { diameter, height } = trunkDimensions(randomValues[index] ?? RANDOM_MIDPOINT)
    getCylinder(scene, world, {
      name: `forest-road-trunk-${index}`,
      size: [diameter, height, diameter] as CoordinateTuple,
      position: [position[0], 0, position[2]] as CoordinateTuple,
      color: pickPaletteColor(TRUNK_COLORS, index),
      roughness: 0.95,
      castShadow: true,
      receiveShadow: true,
      type: 'fixed',
      hasGravity: false
    })
    const canopySize = canopySizeFor(
      randomValues[(index + 1) % randomValues.length] ?? RANDOM_MIDPOINT
    )
    return getBall(scene, undefined, {
      name: `forest-road-canopy-${index}`,
      size: canopySize,
      segments: 12,
      position: canopyCenterFor([position[0], 0, position[2]], height, canopySize),
      color: pickPaletteColor(CANOPY_COLORS, index),
      roughness: 0.9,
      castShadow: true
    })
  })
}

const buildUndergrowth = (scene: THREE.Scene): void => {
  const positions = generateAreaPositions(undergrowthArea).filter(
    (position) => !isOnRoadSurface(position[0], roadHalfWidth + VERGE_CLEARANCE)
  )
  const randomValues = seededRandomValues(UNDERGROWTH_SEED + 1, positions.length)
  positions.forEach((position, index) => {
    const size =
      UNDERGROWTH_MIN_SIZE +
      (randomValues[index] ?? RANDOM_MIDPOINT) * (UNDERGROWTH_MAX_SIZE - UNDERGROWTH_MIN_SIZE)
    getBall(scene, undefined, {
      name: `forest-road-undergrowth-${index}`,
      size,
      segments: 10,
      position: [position[0], size * RANDOM_MIDPOINT, position[2]] as CoordinateTuple,
      color: pickPaletteColor(UNDERGROWTH_COLORS, index),
      roughness: 0.95,
      castShadow: true
    })
  })
}

const buildLeafLitter = (scene: THREE.Scene): THREE.InstancedMesh => {
  const geometry = new THREE.PlaneGeometry(LEAF_WIDTH, LEAF_HEIGHT)
  geometry.rotateX(-Math.PI / 2)
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    side: THREE.DoubleSide
  })
  const mesh = new THREE.InstancedMesh(geometry, material, LEAF_COUNT)
  mesh.name = 'forest-road-leaf-litter'
  mesh.receiveShadow = true
  // The base geometry is one leaf at the origin, so its bounds say nothing
  // about the scattered instances; without this the whole litter vanishes
  // whenever that origin plane leaves the frustum.
  mesh.frustumCulled = false
  const randomValues = seededRandomValues(LEAF_SEED, LEAF_COUNT * 4)
  const dummy = new THREE.Object3D()
  const color = new THREE.Color()
  Array.from({ length: LEAF_COUNT }).forEach((_, index) => {
    const selector = randomValues[index * 4] ?? RANDOM_MIDPOINT
    const along = randomValues[index * 4 + 1] ?? RANDOM_MIDPOINT
    const side = randomValues[index * 4 + 2] ?? RANDOM_MIDPOINT
    const across = randomValues[index * 4 + 3] ?? RANDOM_MIDPOINT
    const x = isRoadLeaf(selector, LEAF_ROAD_SHARE)
      ? leafXFor(side, roadHalfWidth, roadHalfWidth)
      : vergeXFor(side, across, roadHalfWidth, LEAF_SPREAD_X)
    dummy.position.set(
      x,
      leafRestHeight(x, roadHalfWidth),
      leafZFor(along, LEAF_START_Z, LEAF_END_Z)
    )
    dummy.rotation.set(0, across * Math.PI * 2, 0)
    dummy.updateMatrix()
    mesh.setMatrixAt(index, dummy.matrix)
    mesh.setColorAt(index, color.setHex(leafColorFor(index)))
  })
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  scene.add(mesh)
  return mesh
}

const applyLeafDensity = (density: number): void => {
  if (leafMesh) leafMesh.count = Math.floor(LEAF_COUNT * density)
}

const applyRoadWetness = (wetness: number): void => {
  if (!roadMaterial) return
  roadMaterial.roughness = ROAD_ROUGHNESS_DRY - ROAD_ROUGHNESS_WET_DROP * wetness
  roadMaterial.clearcoat = wetness
  roadMaterial.needsUpdate = true
}

watch(
  () => reactiveConfig.value.leafDensity,
  (density) => applyLeafDensity(density as number)
)
watch(
  () => reactiveConfig.value.roadWetness,
  (wetness) => applyRoadWetness(wetness as number)
)

onMounted(async () => {
  if (!canvas.value) return
  setViewPanels({ showConfig: true })
  registerViewConfig(route.name as string, reactiveConfig, configControls)

  await store.init(canvas.value, setupConfig, {
    playMode: true,
    defineSetup: ({ scene, world, clock, animate }) => {
      buildRoad(scene, world, DEFAULT_ROAD_WETNESS)
      const canopies = buildTrees(scene, world)
      canopyBaseX = canopies.map((canopy) => canopy.position.x)
      buildUndergrowth(scene)
      leafMesh = buildLeafLitter(scene)
      applyLeafDensity(DEFAULT_LEAF_DENSITY)

      const timelineManager = createTimelineManager()
      timelineManager.addAction({
        name: 'canopy-sway',
        category: 'visual',
        action: () => {
          if (!reactiveConfig.value.canopySway) return
          const elapsed = clock.getElapsedTime()
          canopies.forEach((canopy, index) => {
            canopy.position.x =
              (canopyBaseX[index] ?? 0) +
              Math.sin(elapsed * SWAY_SPEED + index * SWAY_PHASE_STEP) * SWAY_AMPLITUDE
          })
        }
      })
      animate({ timeline: timelineManager })
    }
  })

  // The day cycle would walk this overcast scene through night a frame later,
  // so it is stopped before its first frame and the declared rig stays in place.
  store.setLightTransitionEnabled(false)
})

onUnmounted(() => {
  store.cleanup()
  clearViewPanels()
  unregisterViewConfig(route.name as string)
  roadMaterial = null
  leafMesh = null
  canopyBaseX = []
})
</script>

<template>
  <canvas ref="canvas" />
</template>

<style scoped>
canvas {
  display: block;
  width: 100%;
  height: 100vh;
}
</style>
