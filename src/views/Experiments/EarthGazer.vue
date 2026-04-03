<script setup lang="ts">
import * as THREE from 'three'
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { video } from '@/utils/video'
import { controls } from '@/utils/control'
import { stats } from '@/utils/stats'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import moonTextureAsset from '@/assets/images/textures/moon.jpg'
import earthDay from '@/assets/images/textures/earth_day.jpg'
import earthNight from '@/assets/images/textures/earth_night.jpg'
import { useDebugSceneStore } from '@/stores/debugScene'

const statsElement = ref(null)
const canvas = ref(null)
const route = useRoute()
const { registerSceneElements, clearSceneElements } = useDebugSceneStore()

onUnmounted(() => {
  clearSceneElements()
})

onMounted(() => {
  ;(init(
    canvas.value as unknown as HTMLCanvasElement,
    statsElement.value as unknown as HTMLElement
  ),
    statsElement.value!)
})

const earthGazerConfig = {
  moonSize: 200,
  earthSize: 20,
  speed: 2,
  details: 10,
  wireframe: false,
  background: [0, 0, 0],
  texture: true,
  opacity: 1,
  offsetX: 1,
  offsetY: 1,
  repeatX: 1,
  repeatY: 1,
  color: false,
  fill: [0, 0, 255],
  light: [255, 255, 255]
}

const getTexture = (img: string) => {
  const textureLoader = new THREE.TextureLoader()
  const texture = textureLoader.load(img)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.offset.set(earthGazerConfig.offsetX, earthGazerConfig.offsetY)
  texture.repeat.set(earthGazerConfig.repeatX, earthGazerConfig.repeatY)
  return texture
}

const buildEarthMesh = (config: typeof earthGazerConfig) => {
  const earthGeometry = new THREE.SphereGeometry(config.earthSize, 32, 32)
  const textureLoader = new THREE.TextureLoader()
  const earthMaterial = new THREE.ShaderMaterial({
    uniforms: {
      earthDayTexture: { value: textureLoader.load(earthDay) },
      earthNightTexture: { value: textureLoader.load(earthNight) },
      opacity: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D earthDayTexture;
      uniform sampler2D earthNightTexture;
      uniform float opacity;
      varying vec2 vUv;
      void main() {
        vec4 color1 = texture2D(earthDayTexture, vUv);
        vec4 color2 = texture2D(earthNightTexture, vUv);
        gl_FragColor = mix(color1, color2, opacity);
      }
    `
  })
  return { earth: new THREE.Mesh(earthGeometry, earthMaterial), earthMaterial }
}

let earthGazerTime = 0

const setupEarthGazer = (canvas: HTMLCanvasElement) => {
  const config = earthGazerConfig
  const renderer = new THREE.WebGLRenderer({ canvas })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setClearColor(new THREE.Color(`rgb(${config.background.map(Math.round).join(',')})`))

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
  const scene = new THREE.Scene()

  const { earth, earthMaterial } = buildEarthMesh(config)
  scene.add(earth)

  const moonGeometry = new THREE.SphereGeometry(config.moonSize, 32, 32)
  const moonMaterial = new THREE.MeshBasicMaterial({
    map: config.texture ? getTexture(moonTextureAsset) : null,
    wireframe: config.wireframe,
    opacity: config.opacity,
    transparent: true,
    color: config.color
      ? new THREE.Color(`rgb(${config.fill.map(Math.round).join(',')})`)
      : undefined
  })
  const moon = new THREE.Mesh(moonGeometry, moonMaterial)

  const orbit = new OrbitControls(camera, renderer.domElement)
  orbit.target.copy(moon.position)
  camera.position.set(100, 0, 0)
  camera.lookAt(0, 0, 0)

  moon.position.y = -200
  scene.add(moon)
  earth.position.y = 35
  earth.rotation.z = -0.6

  scene.add(
    new THREE.AmbientLight(new THREE.Color(`rgb(${config.light.map(Math.round).join(',')})`))
  )
  registerSceneElements(camera, scene.children)
  video.record(canvas, route)

  const animate = () => {
    stats.start(route)
    requestAnimationFrame(animate)
    moon.rotation.z += -0.0001 * config.speed
    earth.rotation.y += 0.0005 * config.speed
    earth.rotation.x += 0.000001 * config.speed
    earthGazerTime += 0.005
    earthMaterial.uniforms.opacity.value = (Math.sin(earthGazerTime) + 1.2) / 2
    orbit.update()
    renderer.render(scene, camera)
    video.stop(renderer.info.render.frame, route)
    stats.end(route)
  }
  animate()
}

const init = (canvas: HTMLCanvasElement, statsElement: HTMLElement) => {
  stats.init(route, statsElement)
  controls.create(
    earthGazerConfig,
    route,
    {
      moonSize: {},
      earthSize: {},
      speed: {},
      details: {},
      opacity: {},
      texture: {},
      offsetX: {},
      offsetY: {},
      repeatX: {},
      repeatY: {},
      wireframe: {},
      color: {},
      fill: { addColor: [] },
      background: { addColor: [] },
      light: { addColor: [] }
    },
    () => {
      setupEarthGazer(canvas)
    }
  )
  setupEarthGazer(canvas)
}
</script>

<template>
  <div ref="statsElement"></div>
  <canvas ref="canvas"></canvas>
</template>
