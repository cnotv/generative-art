<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { init } from "./generate.js";

const statsEl = ref(null)
const canvas = ref(null)

onMounted(() => {
  init(
    canvas.value as unknown as HTMLCanvasElement,
    statsEl.value as unknown as HTMLElement)
})
</script>

<template>
  <canvas ref="canvas"></canvas>
  <div ref="statsEl"></div>
</template>

<style scoped>
</style>
