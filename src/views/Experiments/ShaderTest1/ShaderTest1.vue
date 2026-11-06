<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import * as THREE from 'three'

import { getTools } from '@webgamekit/threejs'
import { createTimelineManager } from '@webgamekit/animation'
import { registerViewConfig, unregisterViewConfig, createReactiveConfig } from '@/stores/viewConfig'
import { useViewPanelsStore } from '@/stores/viewPanels'
import { shaderTest1Config, shaderTest1Schema, setupConfig } from './config'

import vertexShader from './vertexShader.glsl?raw'
import fragmentShader from './fragmentShader.glsl?raw'

const statsElement = ref(null)
const canvas = ref(null)
let initInstance: () => void

const route = useRoute()
const { setViewPanels, clearViewPanels } = useViewPanelsStore()
const reactiveConfig = createReactiveConfig(shaderTest1Config)

onMounted(() => {
  initInstance = () => {
    init(canvas.value as unknown as HTMLCanvasElement, statsElement.value as unknown as HTMLElement)
  }

  setViewPanels({ showConfig: true })
  registerViewConfig(route.name as string, reactiveConfig, shaderTest1Schema)

  initInstance()
  window.addEventListener('resize', initInstance)
})
onUnmounted(() => {
  clearViewPanels()
  unregisterViewConfig(route.name as string)
  window.removeEventListener('resize', initInstance)
})

const init = async (canvas: HTMLCanvasElement, statsElement: HTMLElement) => {
  const createScene = async () => {
    const { animate, setup, getDelta, scene } = await getTools({ canvas })
    setup({
      config: setupConfig,
      defineSetup: async () => {
        const timelineManager = createTimelineManager()
        animate({
          timeline: timelineManager
        })
        const geometry = new THREE.PlaneGeometry(100, 100, 32, 32)
        const initialFrequency = reactiveConfig.value.shader.frequency

        const shaderMaterial = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms: {
            uTime: { value: 0.0 },
            uFrequency: { value: new THREE.Vector2(initialFrequency, initialFrequency) }
          }
        })
        const mesh = new THREE.Mesh(geometry, shaderMaterial)
        scene.add(mesh)

        timelineManager.addAction({
          action: () => {
            shaderMaterial.uniforms.uTime.value += getDelta()
            const frequency = reactiveConfig.value.shader.frequency
            shaderMaterial.uniforms.uFrequency.value.set(frequency, frequency)
          }
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
