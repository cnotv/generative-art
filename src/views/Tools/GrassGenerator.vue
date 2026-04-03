<script setup lang="ts">
import * as THREE from 'three'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { video } from '@/utils/video'
import { stats } from '@/utils/stats'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  getLights,
  getRenderer,
  instanceMatrixMesh,
  setThirdPersonCamera
} from '@webgamekit/threejs'
import { times } from '@/utils/lodash'
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from '@/stores/viewConfig'
import { useViewPanelsStore } from '@/stores/viewPanels'
import { useDebugSceneStore } from '@/stores/debugScene'

const statsElement = ref(null)
const canvas = ref(null)
const route = useRoute()
const animationId = ref(0)
const { setViewPanels, clearViewPanels } = useViewPanelsStore()
const { registerSceneElements, clearSceneElements } = useDebugSceneStore()

// Create reactive config for the panel
const reactiveConfig = createReactiveConfig({
  grass: {
    density: 250,
    scale: 1.5,
    scaleMin: 0.5,
    area: 4,
    points: 10
  },
  lengthCurve: {
    base: { x: 0, y: 0, z: 0 },
    mid: { x: 0, y: 0.28, z: 0.04 },
    tip: { x: 0, y: 0.5, z: -0.07 }
  },
  sideCurve: {
    base: { x: 0.04, y: 0, z: 0 },
    mid: { x: 0.04, y: 0, z: 0 },
    tip: { x: 0, y: 0.5, z: 0 }
  }
})

// Config schema for the panel controls
const configSchema = {
  grass: {
    density: { min: 50, max: 500, step: 10 },
    scale: { min: 0.5, max: 3, step: 0.1 },
    scaleMin: { min: 0.1, max: 1, step: 0.1 },
    area: { min: 1, max: 10, step: 1 },
    points: { min: 3, max: 20, step: 1 }
  },
  lengthCurve: {
    base: {
      component: 'CoordinateInput',
      label: 'Base',
      min: { x: -0.2, y: -0.2, z: -0.2 },
      max: { x: 0.2, y: 0.2, z: 0.2 },
      step: { x: 0.01, y: 0.01, z: 0.01 }
    },
    mid: {
      component: 'CoordinateInput',
      label: 'Mid',
      min: { x: -0.3, y: 0, z: -0.3 },
      max: { x: 0.3, y: 1, z: 0.3 },
      step: { x: 0.01, y: 0.01, z: 0.01 }
    },
    tip: {
      component: 'CoordinateInput',
      label: 'Tip',
      min: { x: -0.3, y: 0, z: -0.3 },
      max: { x: 0.3, y: 1, z: 0.3 },
      step: { x: 0.01, y: 0.01, z: 0.01 }
    }
  },
  sideCurve: {
    base: {
      component: 'CoordinateInput',
      label: 'Base',
      min: { x: 0, y: -0.2, z: -0.2 },
      max: { x: 0.2, y: 0.2, z: 0.2 },
      step: { x: 0.01, y: 0.01, z: 0.01 }
    },
    mid: {
      component: 'CoordinateInput',
      label: 'Mid',
      min: { x: 0, y: -0.2, z: -0.2 },
      max: { x: 0.2, y: 0.2, z: 0.2 },
      step: { x: 0.01, y: 0.01, z: 0.01 }
    },
    tip: {
      component: 'CoordinateInput',
      label: 'Tip',
      min: { x: 0, y: 0, z: -0.2 },
      max: { x: 0.2, y: 1, z: 0.2 },
      step: { x: 0.01, y: 0.01, z: 0.01 }
    }
  }
}

// Reinitialize scene callback (auto-debounced by useViewConfig)
const reinitScene = () => {
  if (animationId.value) {
    cancelAnimationFrame(animationId.value)
  }
  init(canvas.value as unknown as HTMLCanvasElement, statsElement.value as unknown as HTMLElement)
}

onMounted(() => {
  // Set view-specific panels for GlobalNavigation
  setViewPanels({
    showConfig: true
  })

  // Register config with the config panel (onChange callback is auto-debounced)
  registerViewConfig(route.name as string, reactiveConfig, configSchema, reinitScene)
  window.addEventListener('resize', reinitScene)

  init(canvas.value as unknown as HTMLCanvasElement, statsElement.value as unknown as HTMLElement)
})

onBeforeUnmount(() => {
  // Clear view-specific panels
  clearViewPanels()
  clearSceneElements()

  unregisterViewConfig(route.name as string)
  window.removeEventListener('resize', reinitScene)
  if (animationId.value) {
    cancelAnimationFrame(animationId.value)
  }
})

const init = (canvas: HTMLCanvasElement, statsElement: HTMLElement) => {
  // Merge reactive config with static config
  const config = {
    grass: {
      ...reactiveConfig.value.grass,
      offsetX: -2,
      offsetY: 0,
      offsetZ: 0,
      lengthCurve: reactiveConfig.value.lengthCurve,
      sideCurve: reactiveConfig.value.sideCurve
    },
    camera: {
      fixed: true,
      near: 2,
      aspect: window.innerWidth / window.innerHeight,
      far: 1000,
      fov: 8,
      offset: {
        x: -20,
        y: 20,
        z: 40
      },
      lookAt: {
        x: 0,
        y: 0,
        z: 0
      }
    }
  }
  // Set stats
  stats.init(route, statsElement)

  const setup = async () => {
    const renderer = getRenderer(canvas)
    const camera = new THREE.PerspectiveCamera(
      config.camera.fov,
      config.camera.aspect,
      config.camera.near,
      config.camera.far
    )
    const scene = new THREE.Scene()
    const orbit = new OrbitControls(camera, renderer.domElement)
    const matrixProperties = [
      ...generateProperties(config.grass),
      {
        position: [3, 1, 0],
        rotation: [0, -0.45, 0],
        scale: [
          config.grass.scale + config.grass.scaleMin,
          config.grass.scale + config.grass.scaleMin,
          config.grass.scale + config.grass.scaleMin
        ]
      }, // Flat front view
      {
        position: [3, -1, 0],
        rotation: [0, 1, 0],
        scale: [
          config.grass.scale + config.grass.scaleMin,
          config.grass.scale + config.grass.scaleMin,
          config.grass.scale + config.grass.scaleMin
        ]
      }, // Flat side view
      {
        position: [3, -3, 0],
        rotation: [0, 0, 0],
        scale: [
          config.grass.scale + config.grass.scaleMin,
          config.grass.scale + config.grass.scaleMin,
          config.grass.scale + config.grass.scaleMin
        ]
      } // Perspective view
    ] as ModelOptions[]

    camera.position.set(-30, 25, 30)
    getLights(scene)

    const lights = scene.children.filter((c) => c.type.includes('Light'))
    registerSceneElements(camera, [...lights, { name: 'Grass Field', type: 'InstancedMesh' }])

    // Populate grass
    const grass = getGrass(config.grass)
    instanceMatrixMesh(grass, scene, matrixProperties)

    video.record(canvas, route)

    function animate() {
      stats.start(route)
      animationId.value = requestAnimationFrame(animate)
      if (config.camera.fixed) {
        setThirdPersonCamera(camera, config.camera, grass)
      }

      orbit.update()

      renderer.render(scene, camera)
      video.stop(renderer.info.render.frame, route)
      stats.end(route)
    }
    animate()
  }
  setup()
}

const generateProperties = (config: GenerateConfig) =>
  times(config.density * config.area, () => {
    const size = Math.random() * config.scale + config.scaleMin
    const getPosition = () => Math.random() * config.area - config.area / 2

    return {
      position: [
        getPosition() + config.offsetX,
        0,
        getPosition() + config.offsetY + config.offsetZ
      ],
      rotation: [0, Math.random() * 360, 0],
      scale: [size, size, size]
    }
  })

// const lengthCurve = new THREE.CatmullRomCurve3([
//     // new THREE.Vector3(0.01, 0, 0.05),  // Base
//     // new THREE.Vector3(0, 0.40, 0.15),  // Midpoint 1
//     // // new THREE.Vector3(0, 0.50, 0.1),  // Midpoint 2
//     // // new THREE.Vector3(0, 0.60, 0.1),  // Midpoint 3
//     // new THREE.Vector3(0, 0.7, 0.05)  // Tip
//     new THREE.Vector3(config.lengthCurve.base, 0, config.lengthCurve.midX),  // Base
//     new THREE.Vector3(0, config.lengthCurve.midY, config.lengthCurve.midZ),  // Midpoint 1
//     // new THREE.Vector3(0, 0.50, 0.1),  // Midpoint 2
//     // new THREE.Vector3(0, 0.60, 0.1),  // Midpoint 3
//   ]);

//   // Define the control points for the side curve (curvature on the sides)
//   // Vector values respectively: Width blade
//   const sideCurve = new THREE.CatmullRomCurve3([
//     new THREE.Vector3(0.05, 0, 0),  // Base
//     new THREE.Vector3(0.04, 0.25, 0),  // Midpoint 1
//     // new THREE.Vector3(0.03, 0.5, 0),  // Midpoint 2
//     // new THREE.Vector3(0.02, 0.75, 0),  // Midpoint 3
//     new THREE.Vector3(0, 1, 0)  // Tip
//   ]);

const getGrass = (config: GenerateConfig) => {
  // Define the control points for the length curve (curvature along the length)
  // Vector values respectively: bend sides, blade silhouette, bend front
  const lengthCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(
      config.lengthCurve.base.x,
      config.lengthCurve.base.y,
      config.lengthCurve.base.z
    ), // Base
    new THREE.Vector3(config.lengthCurve.mid.x, config.lengthCurve.mid.y, config.lengthCurve.mid.z), // Midpoint
    new THREE.Vector3(config.lengthCurve.tip.x, config.lengthCurve.tip.y, config.lengthCurve.tip.z) // Tip
  ])

  // Define the control points for the side curve (curvature on the sides)
  // Vector values respectively: Width blade
  const sideCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(config.sideCurve.base.x, config.sideCurve.base.y, config.sideCurve.base.z), // Base
    new THREE.Vector3(config.sideCurve.mid.x, config.sideCurve.mid.y, config.sideCurve.mid.z), // Midpoint
    new THREE.Vector3(config.sideCurve.tip.x, config.sideCurve.tip.y, config.sideCurve.tip.z) // Tip
  ])

  // Define the control points for the length curve (curvature along the length)
  const lengthPoints = lengthCurve.getPoints(config.points)

  // Define the control points for the side curve (curvature on the sides)
  const sidePoints = sideCurve.getPoints(config.points)

  const vertices = lengthPoints.flatMap((lengthPoint, i) => {
    const sidePoint = sidePoints[i]
    return [
      lengthPoint.x - sidePoint.x,
      lengthPoint.y,
      lengthPoint.z,
      lengthPoint.x + sidePoint.x,
      lengthPoint.y,
      lengthPoint.z
    ]
  })

  const indices = Array.from({ length: lengthPoints.length - 1 }, (_, i) => {
    const baseIndex = i * 2
    return [baseIndex, baseIndex + 1, baseIndex + 2, baseIndex + 1, baseIndex + 3, baseIndex + 2]
  }).flat()

  // Define the geometry for the grass blade
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  // Define the material for the grass blade
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x33bb33,
    side: THREE.DoubleSide
  })

  // Create the mesh for the grass blade
  const blade = new THREE.Mesh(geometry, material)
  blade.castShadow = false
  blade.receiveShadow = true

  return blade
}
</script>

<template>
  <div ref="statsElement"></div>
  <canvas ref="canvas"></canvas>
</template>
