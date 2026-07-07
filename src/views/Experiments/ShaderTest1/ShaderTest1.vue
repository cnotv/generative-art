<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'

import { getTools, type SetupConfig } from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'

import vertexShader from './vertexShader.glsl?raw'
import fragmentShader from './fragmentShader.glsl?raw'

const statsElement = ref(null)
const canvas = ref(null)
let initInstance: () => void

onMounted(() => {
  initInstance = () => {
    init(canvas.value as unknown as HTMLCanvasElement, statsElement.value as unknown as HTMLElement)
  }

  initInstance()
  window.addEventListener('resize', initInstance)
})
onUnmounted(() => window.removeEventListener('resize', initInstance))

const config: SetupConfig = {
  ground: false,
  sky: false,
  scene: { backgroundColor: 0xffffff }
}

const init = async (canvas: HTMLCanvasElement, statsElement: HTMLElement) => {
  const createScene = async () => {
    const { animate, setup, getDelta, scene } = await getTools({ canvas })
    setup({
      config,
      defineSetup: async () => {
        const timelineManager = createTimelineManager()
        animate({
          timeline: timelineManager
        })
        // const geometry = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight, 32, 32);
        const geometry = new THREE.PlaneGeometry(100, 100, 32, 32)
        const shaderMaterial = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: {
            uTime: { value: 0.0 },
            uFrequency: { value: new THREE.Vector2(10.0, 10.0) }
          }
        })
        const mesh = new THREE.Mesh(geometry, shaderMaterial)
        scene.add(mesh)

        timelineManager.addAction({
          action: () => (shaderMaterial.uniforms.uTime.value += getDelta())
        })
      }
    })
  }
  createScene()
}
</script>

<template>
  <div ref="statsElement"></div>
  <canvas ref="canvas"></canvas>
</template>
