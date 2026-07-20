<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'

import { getTools, type SetupConfig } from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'

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
  scene: { backgroundColor: 0x999999 }
}

const shaderMaterial = new THREE.ShaderMaterial({
  vertexShader: ``,
  fragmentShader: ``
})

const init = async (canvas: HTMLCanvasElement, statsElement: HTMLElement) => {
  const createScene = async () => {
    const { animate, setup, scene } = await getTools({ canvas })
    setup({
      config,
      defineSetup: async () => {
        const timelineManager = createTimelineManager()
        animate({
          timeline: timelineManager
        })
        const geometry = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight)
        const mesh = new THREE.Mesh(geometry, shaderMaterial)
        scene.add(mesh)
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
